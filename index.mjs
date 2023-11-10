import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { uptime } from 'node:process';
import { totalmem, freemem } from 'node:os';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import pkg from 'node-gzip';
const { gzip, ungzip } = pkg;
const app = express();
const server = createServer(app);
let intervalReference;

app.use('/assets', express.static('assets'));

app.get('/', (req, res) => {
  let page = readFileSync('./assets/html/index.html', { encoding: 'utf-8' });
  res.send(page);
});

const serverData = {
  players: new Map(),
  rooms: new Map(),
};

function createId() {
  let newId;
  do {
    newId = randomBytes(4).toString('hex') + "-" + randomBytes(4).toString('hex') + "-" + randomBytes(4).toString('hex') + "-" + randomBytes(4).toString('hex');
  } while (serverData.players.has(newId));
  return newId;
}

function getPlayerBySocket(ws) {
  let foundPlayer = null;
  serverData.players.forEach((player) => {
    if (player.socket === ws) {
      foundPlayer = player;
      return;
    }
  });
  return foundPlayer;
}


function getPlayersInRoom(roomId) {
  const room = serverData.rooms.get(roomId);
  if (!room) return [];
  return room.players;
}

function getTotalPlayerCount() {
  let totalPlayerCount = 0;
  serverData.rooms.forEach((room) => {
    totalPlayerCount += room.playerCount;
  });
  return totalPlayerCount;
}

function joinRoom(ws, roomId, _gameversion) {
  const player = getPlayerBySocket(ws);
  if (player && player.roomId) return console.log(`[Server] Player ${player.id} is already in a room: ${player}`);
  const room = serverData.rooms.get(roomId);
  if (!room) return;
  if (room.gameversion != _gameversion) return;
  const newPlayer = {
    id: createId(),
    socket: ws,
    roomId: roomId,
    local: true,
  };
  room.players.set(newPlayer.id, newPlayer);
  serverData.players.set(newPlayer.id, newPlayer);
  room.playerCount++;
  console.log(`[Server] Player ${newPlayer.id} joined the room ${newPlayer.roomId}`);
  console.log(`[Server] Room ${roomId}'s Player Count: ${room.playerCount}`);
  broadcastRoomInfo();
}

function createRoom(ws, roomName, _scene, _scenepath, _gameversion, max) {
  const player = getPlayerBySocket(ws);
  if (player && player.roomId) return console.log(`[Server] Player ${player.id} is already in a room.`);
  const room = {
    id: createId(),
    maxplayers: max,
    scene: _scene,
    scenepath: _scenepath,
    name: roomName,
    gameversion: _gameversion,
    players: new Map(),
    playerCount: '0',
  };
  if (!serverData.rooms.size > 0) { 
    startInterval() 
  };
  serverData.rooms.set(room.id, room);
  joinRoom(ws, room.id, _gameversion);
}

function removePlayer(ws) {
  const player = getPlayerBySocket(ws);
  if (player == null) return;
  const room = serverData.rooms.get(player.roomId);
  if (room) {
    room.players.delete(player.id);
    room.playerCount--;
    console.log(`[Server] Player ${player.id} left from the room ${player.roomId}`);
    console.log(`[Server] Room ${player.roomId}'s Player Count: ${room.playerCount}`);
    if (room.players.size === 0) {
      serverData.rooms.delete(room.id);
      clearInterval(intervalReference);
    }
  }
  serverData.players.delete(player.id);
}

setInterval(function () {
  global.gc();
}, 1000 * 30);

function broadcastRoomInfo() {
  serverData.players.forEach((player) => {
    if (player == null) return;
    const room = serverData.rooms.get(player.roomId);
    if(!room) return;
    const playerIds = Array.from(room.players.keys()).map((id) => ({
      playerId: id,
      local: id === player.id,
      roomId: room.id,
    }));
    let json = JSON.stringify({
      action: 'roominfo',
      playerIds: playerIds,
      scene: room.scene,
      scenepath: room.scenepath,
      gameversion: room.gameversion,
      id: createId(),
    });
    SendMessage(player.socket, json);
  });
}

function handleRPC(ws, data) {
  let player = getPlayerBySocket(ws)
  if (player === null) return;
  let players = getPlayersInRoom(player.roomId);
  players.forEach((p) => {
    let parsedData = JSON.parse(data);
    const _data = JSON.stringify({
      action: parsedData.action,
      rpc: parsedData.rpc,
      sender: player.id,
      id: createId(),
    });
    if (p.socket && p.socket.send) {
      SendMessage(p.socket, _data);
    }
  });
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
  timeUnits.forEach(({ unit, seconds }) => {
    const value = Math.floor(remainingSeconds / seconds);
    remainingSeconds %= seconds;
    if (value > 0) {
      durationString += `${value} ${unit}${value !== 1 ? 's' : ''} `;
    }
  });
  return durationString.trim();
}

function roomList(ws, amount, emptyonly) {
  if(serverData.rooms.size < 0) return;
  serverData.rooms.forEach((room) => {
    const _data = JSON.stringify({
      action: 'roomlist_roominfo',
      roomName: room.name,
      roomId: room.id,
      roomversion: room.gameversion,
      playercount: room.players.size,
    });
    if (room.players.size < room.maxplayers || !emptyonly) return SendMessage(ws, _data);
  });
}

function getCurrentPlayers(ws) {
  const player = getPlayerBySocket(ws);
  if (player == null) return;
  const room = serverData.rooms.get(player.roomId);
  if(!room) return;
  const playerIds = Array.from(room.players.keys()).map((id) => ({
    playerId: id,
    local: id === player.id,
    roomId: room.id,
  }));
  let json = JSON.stringify({
    action: 'currentplayers',
    playerIds: playerIds,
    scene: room.scene,
    scenepath: room.scenepath,
    gameversion: room.gameversion,
    id: createId(),
  });
  SendMessage(player.socket, json);
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
  MessagesToSend.forEach(async (messages, socket) => {
    const bundledMessage = messages.join('\n');
    try {
      let compressedData = await gzip(bundledMessage);
      socket.emit('clientmessage', compressedData);
    } catch (error) {
      console.error("Error compressing and sending message:", error);
    }
  });
  MessagesToSend.clear();
}

const connectedWebClients = new Map();
const MessagesToSend = new Map();

function startInterval() {
  intervalReference = setInterval(sendBundledCompressedMessages, 1000 / 30);
}

const wss = new Server(server, {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e8,
  pingTimeout: 60000
});


setInterval(() => {
  if (connectedWebClients.size > 0) {
    const roomslistid = [];
    const totalMemoryInMB = (totalmem() / (1024 ** 2)).toFixed(2);
    const freeMemoryInMB = (freemem() / (1024 ** 2)).toFixed(2);
    const memoryUsed = (totalMemoryInMB - freeMemoryInMB).toFixed(2);
    serverData.rooms.forEach((room) => {
      roomslistid.push({
        RoomID: room.id,
        RoomName: room.name,
        RoomPlayerCount: room.playerCount,
        RoomPlayerMax: room.maxplayers,
        RoomGameVersion: room.gameversion,
      });
    });

    connectedWebClients.forEach((client) => {
      const data = {
        rooms: roomslistid,
        globalplayercount: getTotalPlayerCount(),
        uptime: convertSecondsToUnits(Math.round(uptime())),
        usage: Math.round(memoryUsed),
      };
      client.emit("webmessageclient", data);
    })
  }
}, 1000);

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const decompressedmessage = await ungzip(message);
    const buffer = Buffer.from(decompressedmessage);
    const messagelist = buffer.toString('utf8').split('\n');
    const filteredMessageList = messagelist.filter(msg => msg.trim() !== '');
    filteredMessageList.forEach((element) => {
      try {
        const data = JSON.parse(element);
        handleAction(ws, data);
      } catch (err) {
        return;
      }
    });
  });
  

  ws.on('ping', (timestamp) => {
    ws.volatile.emit('pong', timestamp);
    let player = getPlayerBySocket(ws);
    if (player != null) {
      player.lastMessageTime = Date.now();
    }
  });

  ws.on('webmessage', () => {
    connectedWebClients.set(ws, ws);
    console.log("[Server] Web Client Connected");
  });

  ws.on('disconnect', () => {
    if (connectedWebClients.has(ws)) {
      connectedWebClients.delete(ws);
      console.log("[Server] Web Client Removed");
    } else {
      removePlayer(ws);
    }
  });
});

const port = 8880;
server.listen(port, () => {
  console.log(`[Server] Listening on port ${port}`);
});
