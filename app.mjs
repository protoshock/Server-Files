import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'node-gzip';
import path from 'path';
import express from 'express';
import process from 'process';
import os from 'os';


const { gzip, ungzip } = pkg;

const app = express();
const server = http.createServer(app);

app.get('/', (req, res) => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  res.sendFile(__dirname + '/index.html');
});

const wss = new Server(server, {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e8,
  pingTimeout: 60000
});

var playercount = 0;
const serverData = {
  players: new Map(),
  rooms: new Map(),
};

function generateId() {
  return uuidv4(); // Generate a unique room ID using the uuid library
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

  if (player && player.roomId) {
    console.log('Player is already in a room:', player);
    return;
  }

  const room = serverData.rooms.get(roomId);
  if (!room) {
    console.log('Room not found:', roomId);
    return;
  }

  if (room.gameversion != _gameversion) return;

  const newPlayer = {
    id: generateId(),
    socket: ws,
    roomId: roomId,
    local: true
  };
  room.players.set(newPlayer.id, newPlayer);
  serverData.players.set(newPlayer.id, newPlayer);
  playercount = playercount + 1;
  console.log(newPlayer.id + " joined room: " + newPlayer.roomId);
  console.log("Player count: " + playercount);

  broadcastRoomInfo(ws);
}

async function createRoom(ws, roomName, _scene, _scenepath, _gameversion, max) {
  const player = getPlayerBySocket(ws);

  if (player && player.roomId) {
    console.log('Player is already in a room:', player);
    return;
  }

  const roomId = generateId();
  const room = {
    id: roomId,
    maxplayers: max,
    scene: _scene,
    scenepath: _scenepath,
    name: roomName,
    gameversion: _gameversion,
    players: [],
  };

  room.players = new Map();
  await serverData.rooms.set(roomId, room);

  joinRoom(ws, roomId, _gameversion);
}

function removePlayer(ws) {
  const player = getPlayerBySocket(ws);

  if (player == null) return;

  const room = serverData.rooms.get(player.roomId);
  if (room) {
    room.players.delete(player.id);
    playercount = playercount - 1;
    console.log(player.id + " left from room: " + player.roomId);
    console.log("Player count: " + playercount);

    if (room.players.size === 0) {
      serverData.rooms.delete(room.id);
    }
  }

  serverData.players.delete(player.id);
}

async function broadcastRoomInfo() {
  for (const [_, player] of serverData.players.entries()) {
    if (player == null) return;
    const room = serverData.rooms.get(player.roomId);
    if (room) {
      const playerIds = Array.from(room.players.keys()).map((id) => ({
        playerId: id,
        local: id === player.id,
        roomId: room.id
      }));
      var json = JSON.stringify({
        action: 'roominfo',
        playerIds: playerIds,
        scene: room.scene,
        scenepath: room.scenepath,
        gameversion: room.gameversion,
        id: generateId()
      });
      SendMessage(player.socket, json);
    }
  }
}

async function handleRPC(ws, data) {
  var player = getPlayerBySocket(ws);
  if (player == null) return;
  var players = getPlayersInRoom(player.roomId);
  for (const [_, p] of players.entries()) {
    var parsedData = JSON.parse(data);
    var action = parsedData.action;
    var rpc = parsedData.rpc;
    const _data = JSON.stringify({
      action,
      rpc,
      sender: player.id,
      id: generateId(),
    });
    if (p.socket && p.socket.send) {
      SendMessage(p.socket, _data);
    }
  }
  player.lastMessageTime = Date.now();
}

function convertSecondsToExactDuration(seconds) {
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30.44;
  const year = day * 365.25;

  const years = Math.floor(seconds / year);
  const months = Math.floor((seconds % year) / month);
  const weeks = Math.floor(((seconds % year) % month) / week);
  const days = Math.floor((((seconds % year) % month) % week) / day);
  const hours = Math.floor(((((seconds % year) % month) % week) % day) / hour);
  const minutes = Math.floor((((((seconds % year) % month) % week) % day) % hour) / minute);
  const remainingSeconds = Math.floor(((((((seconds % year) % month) % week) % day) % hour) % minute) % minute);


  let durationString = '';
  if (years > 0) durationString += years + ' year' + (years !== 1 ? 's' : '') + ' ';
  if (months > 0) durationString += months + ' month' + (months !== 1 ? 's' : '') + ' ';
  if (weeks > 0) durationString += weeks + ' week' + (weeks !== 1 ? 's' : '') + ' ';
  if (days > 0) durationString += days + ' day' + (days !== 1 ? 's' : '') + ' ';
  if (hours > 0) durationString += hours + ' hour' + (hours !== 1 ? 's' : '') + ' ';
  if (minutes > 0) durationString += minutes + ' minute' + (minutes !== 1 ? 's' : '') + ' ';
  if (remainingSeconds > 0) durationString += remainingSeconds + ' second' + (remainingSeconds !== 1 ? 's' : '');

  return durationString.trim();
}

setInterval(() => {
  var roomslistid = [];
  if (connectedWebClients.size > 0) {
    var count = 0;
    for (const [_, room] of serverData.rooms.entries()) {
      if (count > 25) {
        break;
      }
      roomslistid.push({
        RoomID: room.id,
        RoomName: room.name,
        RoomPlayerCount: room.players.size,
        RoomPlayerMax: room.maxplayers,
        RoomGameVersion: room.gameversion
      });
      count++;
    }
    const totalMemoryInBytes = os.totalmem();
    const totalMemoryInMB = (totalMemoryInBytes / (1024 ** 2)).toFixed(2);

    // Get free system memory (in bytes)
    const freeMemoryInBytes = os.freemem();
    const freeMemoryInMB = (freeMemoryInBytes / (1024 ** 2)).toFixed(2);

    // Calculate used memory in MB
    const usedMemoryInMB = (totalMemoryInMB - freeMemoryInMB).toFixed(2);
    connectedWebClients.forEach((client) => {
      const data = {
        rooms: roomslistid,
        globalplayercount: playercount,
        uptime: convertSecondsToExactDuration(Math.round(process.uptime())),
        usage: Math.round(usedMemoryInMB),
      };
      client.emit("webmessageclient", data);
    });
  }
}, 1000)

setInterval(() => {

  // Kick players not in rooms
  const currentTime = Date.now();
  serverData.players.forEach((player) => {
    if (player.lastMessageTime && currentTime - player.lastMessageTime > 10000) {
      removePlayer(player.socket);
    }
  });
}, 5000);


async function roomlist(ws, amount, emptyonly) {
  var count = 0;
  for (const [_, room] of serverData.rooms.entries()) {
    if (count > amount) {
      break;
    }
    const _data = JSON.stringify({
      action: "roomlist_roominfo",
      roomName: room.name,
      roomId: room.id,
      roomversion: room.gameversion,
      playercount: room.players.size
    });
    if (room.players.size <= room.maxplayers || !emptyonly) {
      SendMessage(ws, _data);
      count++;
    }
  }
}

async function getcurrentplayers(ws) {
  const player = getPlayerBySocket(ws);

  if (player == null) return;
  const room = serverData.rooms.get(player.roomId);

  if (room) {
    const playerIds = Array.from(room.players.keys()).map((id) => ({
      playerId: id,
      local: id === player.id,
      roomId: room.id
    }));
    var json = JSON.stringify({
      action: 'currentplayers',
      playerIds: playerIds,
      scene: room.scene,
      scenepath: room.scenepath,
      gameversion: room.gameversion,
      id: generateId()
    });
    SendMessage(player.socket, json);
  }
}

const connectedWebClients = new Map();


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
      roomlist(ws, data.amount, data.emptyonly);
      break;
    case 'getcurrentplayers':
      getcurrentplayers(ws);
      break;
    case 'leave':
      removePlayer(ws);
      break;
    default:
      break;
  }
}

var MessagesToSend = new Map();

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

const port = 8880;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});