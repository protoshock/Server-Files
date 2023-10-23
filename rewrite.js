const http = require('http');
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid');
const { gzip, ungzip } = require('node-gzip');
const path = require('path');
const express = require('express');
const process = require('process');
const os = require('node:os');

// Web Server
const app = express();
const server = http.createServer(app);

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
    return Array.from(serverData.players.values()).find(player => player.socket === ws) || null;
}

function getPlayersInRoom(roomId) {
    const room = serverData.rooms.get(roomId);
    return room ? room.players : [];
}
  
function joinRoom(ws, roomId, _gameversion) {
    const player = getPlayerBySocket(ws);
  
    if (player && player.roomId) {
      console.log('Player is already in a room:', player);
      return;
    }
  
    const room = serverData.rooms.get(roomId);
  
    if (!room || room.gameversion !== _gameversion) {
      return;
    }
  
    const newPlayer = {
      id: createId(),
      socket: ws,
      roomId: roomId,
      local: true
    };
  
    room.players.set(newPlayer.id, newPlayer);
    serverData.players.set(newPlayer.id, newPlayer);
    playerCount++;
  
    console.log(`${newPlayer.id} joined room: ${newPlayer.roomId}`);
    console.log(`Player count: ${playerCount}`);
  
    broadcastRoomInfo(ws);
}
  
async function createRoom(ws, roomName, _scene, _scenepath, _gameversion, max) {
    const player = getPlayerBySocket(ws);
  
    if (player && player.roomId) {
      console.log('Player is already in a room:', player);
      return;
    }
  
    const roomId = createId();
    const room = {
      id: roomId,
      maxplayers: max,
      scene: _scene,
      scenepath: _scenepath,
      name: roomName,
      gameversion: _gameversion,
      players: new Map(),
    };
  
    serverData.rooms.set(roomId, room);
  
    joinRoom(ws, roomId, _gameversion);
}
  
function removePlayer(ws) {
    const player = getPlayerBySocket(ws);
    if (!player) return;
  
    const roomId = player.roomId;
    const room = serverData.rooms.get(roomId);
    if (room) {
      room.players.delete(player.id);
      playerCount--;
  
      console.log(`${player.id} left from room: ${roomId}`);
      console.log(`Player count: ${playerCount}`);
  
      if (room.players.size === 0) {
        serverData.rooms.delete(roomId);
      }
    }
    serverData.players.delete(player.id);
}
  
async function broadcastRoomInfo(ws) {
    const playerIdsPromises = [];
  
    serverData.players.forEach(async (player) => {
      const room = serverData.rooms.get(player.roomId);
  
      if (room) {
        const playerIds = Array.from(room.players.keys()).map(id => ({
          playerId: id,
          local: id === player.id,
          roomId: room.id,
        }));
  
        const json = JSON.stringify({
          action: 'roominfo',
          playerIds: playerIds,
          scene: room.scene,
          scenepath: room.scenepath,
          gameversion: room.gameversion,
          id: createId(),
        });
  
        console.log(json);
  
        playerIdsPromises.push(SendMessage(player.socket, json));
      }
    });
  
    // Await all the message sending promises concurrently
    await Promise.all(playerIdsPromises);
}
  
async function handleRPC(ws, data) {
    const player = getPlayerBySocket(ws);
  
    if (!player) return;
  
    const players = getPlayersInRoom(player.roomId);
  
    const parsedData = JSON.parse(data);
    const { action, rpc } = parsedData;
  
    const messageData = JSON.stringify({
      action,
      rpc,
      sender: player.id,
      id: createId(),
    });
  
    const sendMessagePromises = [];
  
    players.forEach((p) => {
      if (p.socket && p.socket.send) {
        sendMessagePromises.push(SendMessage(p.socket, messageData));
      }
    });
  
    await Promise.all(sendMessagePromises);
  
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
    let remainingSeconds = seconds; // Track remaining seconds
  
    timeUnits.forEach(({ unit, seconds }) => {
      const value = Math.floor(remainingSeconds / seconds); // Calculate the value
      remainingSeconds %= seconds; // Update remaining seconds
  
      if (value > 0) {
        durationString += `${value} ${unit}${value !== 1 ? 's' : ''} `;
      }
    });
  
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
    let messages = MessagesToSend.get(ws);
  
    if (!messages) {
      messages = [];
      MessagesToSend.set(ws, messages);
    }
  
    messages.push(data);
}
  
async function sendBundledCompressedMessages() {
    MessagesToSend.forEach(async (messages, socket) => {
      const player = getPlayerBySocket(socket);
      if (player) {
        const bundledMessage = messages.join('\n');
  
        try {
          const compressedData = await gzip(bundledMessage);
          socket.emit('clientmessage', compressedData);
        } catch (error) {
          console.error("Error compressing and sending message:", error);
        }
      }
    });
  
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
      const roomEntries = serverData.rooms.entries();
      let count = 0;
  
      roomEntries.forEach(([_, room]) => {
        if (count > 25) {
          return;
        }
        roomslistid.push({
          RoomID: room.id,
          RoomName: room.name,
          RoomPlayerCount: room.players.size,
          RoomPlayerMax: room.maxplayers,
          RoomGameVersion: room.gameversion,
        });
        count++;
      });      
  
      const totalMemoryInBytes = os.totalmem();
      const totalMemoryInMB = (totalMemoryInBytes / (1024 ** 2)).toFixed(2);
  
      const freeMemoryInBytes = os.freemem();
      const freeMemoryInMB = (freeMemoryInBytes / (1024 ** 2)).toFixed(2);
  
      const usedMemoryInMB = (totalMemoryInMB - freeMemoryInMB).toFixed(2);
  
      connectedWebClients.forEach((client) => {
        const data = {
          rooms: roomslistid,
          globalplayercount: playerCount,
          uptime: convertSecondsToExactDuration(Math.round(process.uptime())),
          usage: Math.round(usedMemoryInMB),
        };
        client.emit("webmessageclient", data);
      });
    }
}, 1000);

const connectedWebClients = new Map();
const MessagesToSend = new Map();

setInterval(sendBundledCompressedMessages, 1000 / 30);
  
wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
      try {
        const decompressedmessage = await ungzip(message);
        const buffer = Buffer.from(decompressedmessage);
        const messagelist = buffer.toString('utf8').split("\n");
  
        messagelist.forEach(async (element) => {
          try {
            const data = JSON.parse(element);
            await handleAction(ws, data);
          } catch (error) {
            console.error("Error parsing JSON:", error);
          }
        });
      } catch (error) {
        console.error("Error decompressing message:", error);
      }
    });
  
    ws.on("ping", (timestamp) => {
      ws.volatile.emit("pong", timestamp);
      const player = getPlayerBySocket(ws);
      if (player) {
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