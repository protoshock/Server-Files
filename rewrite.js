const { createServer }= require('http');
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid');
const { gzip, ungzip } = require('node-gzip');
const path = require('node:path');
const express = require('express');
const { uptime } = require('process');
const { totalmem, freemem } = require('node:os');
// Web Server
const app = express();
const server = createServer(app);
try {
// Game Server
let playerCount = 0;
const serverData = {
    players: new Map(),
    rooms: new Map()
}

function createId() {
    return uuidv4();
}

function getPlayerBySocket(ws) {
  for (const [_, player] of serverData.players.entries()) {
    if (player.socket === ws) {
      return player;
    }
  }
  return null;
}

function getPlayersInRoom(roomId) {
  const room = serverData.rooms.get(roomId);
  if (room) {
    return room.players;
  }
  return [];
}

function joinRoom(ws, roomId, _gameversion) {
  const player = getPlayerBySocket(ws);
  console.log(player)
  const room = serverData.rooms.get(roomId);
  if (player && player.roomId) return console.log('Player is already in a room:', player);
  if (!room) return console.log('Room not found: ' + roomId);

  if (room.gameversion != _gameversion) return;
  const newPlayer = {
    id: createId(),
    socket: ws,
    roomId: roomId,
    local: true
  };
  room.players.set(newPlayer.id, newPlayer);
  serverData.players.set(newPlayer.id, newPlayer);
  playerCount++
  console.log(newPlayer.id + " joined room: " + newPlayer.roomId);
  console.log("Player count: " + playerCount);
  broadcastRoomInfo(ws);
}

async function createRoom(ws, roomName, _scene, _scenepath, _gameversion, max) {
  const player = getPlayerBySocket(ws);
  if (player && player.roomId) return console.log('Player is already in a room:', player);
  const room = {
    id: createId(),
    maxplayers: max,
    scene: _scene,
    scenepath: _scenepath,
    name: roomName,
    gameversion: _gameversion,
    players: new Map(),
  };
  serverData.rooms.set(room.id, room);
  joinRoom(ws, room.id, _gameversion);
}
  
function removePlayer(ws) {
  const player = getPlayerBySocket(ws);
  const roomId = player.roomId;
  const room = serverData.rooms.get(roomId);
  if (!player) return;
  if (room) {
    room.players.delete(player.id);
    playerCount--;
    if (room.players.size > 0) {
      serverData.rooms.delete(roomId);
    }
  }
  serverData.players.delete(player.id);
}
  
setInterval(function(){
  global.gc();
  console.log('GC done')
}, 1000*30);

function broadcastRoomInfo(ws) {
  const player = getPlayerBySocket(ws)
  for (const [roomId, room] of serverData.rooms) {
    const playerIds = Array.from(room.players.keys()).map(id => ({
      playerId: id,
      local: id === player.id,
      roomId: roomId,
    }));
    const json = JSON.stringify({
      action: 'roominfo',
      playerIds: playerIds,
      scene: room.scene,
      scenepath: room.scenepath,
      gameversion: room.gameversion,
      id: createId(),
    });
    SendMessage(player.socket, json);
  }
}

async function handleRPC(ws, data) {
  var player = getPlayerBySocket(ws);
  var players = getPlayersInRoom(player.roomId);
  if (player == null) return;
  for (const [_, p] of players.entries()) {
    var parsedData = JSON.parse(data);
    const _data = JSON.stringify({
      action: parsedData.action,
      rpc: parsedData.rpc,
      sender: player.id,
      id: createId(),
    });
    if (p.socket && p.socket.send) {
      SendMessage(p.socket, _data);
    }
  }
  player.lastMessageTime = Date.now();
}

function convertSecondsToUnits(seconds) {
  const timeUnits = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  let durationString = '';
  let remainingSeconds = seconds;

  for (const { unit, seconds } of timeUnits) {
    const value = Math.floor(remainingSeconds / seconds);
    remainingSeconds %= seconds;

    if (value > 0) {
      durationString += `${value} ${unit}${value !== 1 ? 's' : ''} `;
    }
  }

  return durationString.trim();
}

async function roomList(ws, amount, emptyonly) {
    const roomsToSend = [];
  
    serverData.rooms.forEach((room) => {
      if (roomsToSend.length >= amount) return;
  
      if (room.players.size <= room.maxplayers || !emptyonly) {
        roomsToSend.push({
          roomName: room.name,
          roomId: room.id,
          roomversion: room.gameversion,
          playercount: room.players.size,
        });
      }
    });
  
    SendMessage(ws, JSON.stringify({ action: "roomlist_roominfo", rooms: roomsToSend }));
}
  
async function getCurrentPlayers(ws) {
    const player = getPlayerBySocket(ws);
  
    if (!player) return;
  
    const room = serverData.rooms.get(player.roomId);
  
    if (room) {
      const playerIds = Array.from(room.players.keys()).map(id => ({
        playerId: id,
        local: id === player.id,
        roomId: room.id,
      }));
  
      const jsonData = {
        action: 'currentplayers',
        playerIds,
        scene: room.scene,
        scenepath: room.scenepath,
        gameversion: room.gameversion,
        id: createId(),
      };
  
      SendMessage(player.socket, JSON.stringify(jsonData));
    }
}

function handleAction(ws, data) {
    switch (data.action) {
      case 'createRoom':
        createRoom(ws, data.roomName, data.scene, data.scenepath, data.gameversion, data.maxplayers);
        break;
      case 'joinRoom':
        joinRoom(ws, data.roomId, data.gameversion);
        break;
      case 'rpc':
        handleRPC(ws, JSON.stringify(data));
        break;
      case 'getroomlist':
        roomList(ws, data.amount, data.emptyonly);
        break;
      case 'getcurrentplayers':
        getCurrentPlayers(ws);
        break;
      case 'leave':
        removePlayer(ws);
        break;
      default:
        break;
    }
}

function SendMessage(ws, data) {
  if (MessagesToSend.has(ws)) {
    MessagesToSend.get(ws).push(data);
  } else {
    MessagesToSend.set(ws, [data]);
  }
}

async function sendBundledCompressedMessages() {
  for (const [socket, messages] of MessagesToSend) {
    /*
    if(getPlayerBySocket(socket) != null){
      console.log(getPlayerBySocket(socket).id + " recieved: " + messages.length.toString() + " from buffer"); 
    }*/
    const bundledMessage = messages.join('\n');

    try {
      var compressedData = await gzip(bundledMessage);

      socket.emit('clientmessage', compressedData);
    } catch (error) {
      console.error("Error compressing and sending message:", error);
    }
  }
  MessagesToSend.clear();
}

const wss = new Server(server, {
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 10e8,
    pingTimeout: 60000
});

setInterval(() => {
  if (connectedWebClients.size > 0) {
      const roomslistid = [];
      let count = 0;

      for (const [_, room] of serverData.rooms) {
          if (count > 25) {
              break;
          }
          roomslistid.push({
              RoomID: room.id,
              RoomName: room.name,
              RoomPlayerCount: room.players.size,
              RoomPlayerMax: room.maxplayers,
              RoomGameVersion: room.gameversion,
          });
          count++;
      }

      const totalMemoryInBytes = totalmem();
      const totalMemoryInMB = (totalMemoryInBytes / (1024 ** 2)).toFixed(2);

      const freeMemoryInBytes = freemem();
      const freeMemoryInMB = (freeMemoryInBytes / (1024 ** 2)).toFixed(2);

      const usedMemoryInMB = (totalMemoryInMB - freeMemoryInMB).toFixed(2);

      for (const client of connectedWebClients.values()) {
          const data = {
              rooms: roomslistid,
              globalplayercount: playerCount,
              uptime: convertSecondsToUnits(Math.round(uptime())),
              usage: Math.round(usedMemoryInMB),
          };
          client.emit("webmessageclient", data);
      }
  }
}, 1000);

const connectedWebClients = new Map();
const MessagesToSend = new Map();

setInterval(sendBundledCompressedMessages, 1000 / 30);



wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const decompressedmessage = await ungzip(message); // Assuming ungzip is an asynchronous function

    // Convert the array of bytes to a Buffer
    const buffer = Buffer.from(decompressedmessage);

    const messagelist = buffer.toString('utf8').split("\n");
    (messagelist).forEach(element => {
      try {
        const data = JSON.parse(element);

        // Handle actions using a routing system
        handleAction(ws, data);
      } catch {

      }
    });
  });


  ws.on("ping", (timestamp) => {
    ws.volatile.emit("pong", timestamp);
    var player = getPlayerBySocket(ws);
    if (player != null) {
      player.lastMessageTime = Date.now();
    }
  });

  ws.on('webmessage', () => {
    connectedWebClients.set(ws, ws);
    console.log("web client connected");
  });
  ws.on('disconnect', () => {
    if (connectedWebClients.has(ws)) {
      connectedWebClients.delete(ws);
      console.log("web client removed");
    } else {
      removePlayer(ws);
    }
  });
});
} catch (err) {
  console.log(err)
}
const port = 8880;
server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});