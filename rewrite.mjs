import { createServer } from 'node:http';
import { Server } from 'socket.io';
import express from 'express';
import { uptime } from 'node:process';
import { totalmem, freemem } from 'node:os';
import crypto from 'node:crypto';
import pkg from 'node-gzip';
import fs from 'fs';
const { gzip, ungzip } = pkg;

const app = express();
const server = createServer(app);
app.use('/public', express.static('public'));

app.get('/', (req, res) => {
  let page = fs.readFileSync('./index.html', { encoding: 'utf-8' });
  res.send(page);
});

app.get('/:roomId', (req, res) => {
  let roomId = req.params.roomId;
  const room = serverData.rooms.get(roomId);
  if (!room) return res.redirect('/');
  let page = fs.readFileSync('./room.html', { encoding: 'utf-8' });
  page = page.replace(/{room-name}/g, room.name);
  page = page.replace(/{room-count}/g, room.playerCount);
  page = page.replace(/{room-maxcount}/g, room.maxplayers);
  page = page.replace(/{room-version}/g, room.gameversion);
  res.send(page);
});

let playerCount = 0;
const serverData = {
  players: new Map(),
  rooms: new Map(),
};

function createId() {
  return crypto.randomBytes(4).toString('hex');
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
  playerCount++;
  console.log(`[Server] Player ${newPlayer.id} joined the room ${newPlayer.roomId}`);
  console.log(`[Server] Room ${roomId}'s Player Count: ${room.playerCount}`);
  console.log(`[Server] Global Player Count: ${playerCount}`);
  broadcastRoomInfo(ws);
}

async function createRoom(ws, roomName, _scene, _scenepath, _gameversion, max) {
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
    playerCount--;
    console.log(`[Server] Player ${player.id} left from the room ${player.roomId}`);
    console.log(`[Server] Room ${player.roomId}'s Player Count: ${room.playerCount}`);
    console.log(`[Server] Global Player Count: ${playerCount}`);
    if (room.players.size === 0) {
      serverData.rooms.delete(room.id);
    }
  }
  serverData.players.delete(player.id);
}

setInterval(function () {
  global.gc();
}, 1000 * 30);

async function broadcastRoomInfo() {
  for (const [_, player] of serverData.players.entries()) {
    if (player == null) return;
    const room = serverData.rooms.get(player.roomId);
    if (room) {
      const playerIds = Array.from(room.players.keys()).map((id) => ({
        playerId: id,
        local: id === player.id,
        roomId: room.id,
      }));
      var json = JSON.stringify({
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
}

async function handleRPC(ws, data) {
  var player = getPlayerBySocket(ws);
  if (player == null) return;
  var players = getPlayersInRoom(player.roomId);
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
  var count = 0;
  for (const [_, room] of serverData.rooms.entries()) {
    if (count > amount) {
      break;
    }
    const _data = JSON.stringify({
      action: 'roomlist_roominfo',
      roomName: room.name,
      roomId: room.id,
      roomversion: room.gameversion,
      playercount: room.players.size,
    });
    if (room.players.size <= room.maxplayers || !emptyonly) {
      SendMessage(ws, _data);
      count++;
    }
  }
}

async function getCurrentPlayers(ws) {
  const player = getPlayerBySocket(ws);

  if (player == null) return;
  const room = serverData.rooms.get(player.roomId);

  if (room) {
    const playerIds = Array.from(room.players.keys()).map((id) => ({
      playerId: id,
      local: id === player.id,
      roomId: room.id,
    }));
    var json = JSON.stringify({
      action: 'currentplayers',
      playerIds: playerIds,
      scene: room.scene,
      scenepath: room.scenepath,
      gameversion: room.gameversion,
      id: createId(),
    });
    SendMessage(player.socket, json);
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

const connectedWebClients = new Map();
const MessagesToSend = new Map();

setInterval(sendBundledCompressedMessages, 1000 / 30);

const wss = new Server(server, {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e8,
  pingTimeout: 60000
});

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const decompressedmessage = await ungzip(message);
    const buffer = Buffer.from(decompressedmessage);
    const messagelist = buffer.toString('utf8').split('\n');
    messagelist.forEach((element) => {
      const data = JSON.parse(element);
      handleAction(ws, data);
    });
  });

  ws.on('ping', (timestamp) => {
    ws.volatile.emit('pong', timestamp);
    var player = getPlayerBySocket(ws);
    if (player != null) {
      player.lastMessageTime = Date.now();
    }
  });

  ws.on('webmessage', () => {
    connectedWebClients.set(ws, ws);
    console.log("[Server] Web Client Connected");
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
            RoomPlayerCount: room.playerCount,
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
