import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'node-gzip';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import process from 'process';
import os from 'os';
const { gzip, ungzip } = pkg;
const app = express();
const server = http.createServer(app);
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use('/assets', express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const wss = new Server(server, {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e8,
  pingTimeout: 60000
});

let playercount = 0;

const serverData = {
  players: new Map(),
  rooms: new Map(),
};

function generateId() {
  return uuidv4();
}

function getPlayerBySocket(ws) {
  for (const player of serverData.players.values()) {
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
  playercount++;
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
    players: new Map(),
  };

  await serverData.rooms.set(roomId, room);

  joinRoom(ws, roomId, _gameversion);
}

function removePlayer(ws) {
  const player = getPlayerBySocket(ws);

  if (player == null) return;

  const room = serverData.rooms.get(player.roomId);
  if (room) {
    room.players.delete(player.id);
    playercount--;
    console.log(player.id + " left from room: " + player.roomId);
    console.log("Player count: " + playercount);

    if (room.players.size === 0) {
      serverData.rooms.delete(room.id);
    }
  }

  serverData.players.delete(player.id);
}

async function broadcastRoomInfo(ws) {
  for (const player of serverData.players.values()) {
    const room = serverData.rooms.get(player.roomId);
    if (room) {
      const playerIds = Array.from(room.players.keys()).map((id) => ({
        playerId: id,
        local: id === player.id,
        roomId: room.id
      }));
      const json = JSON.stringify({
        action: 'roominfo',
        playerIds: playerIds,
        scene: room.scene,
        scenepath: room.scenepath,
        gameversion: room.gameversion,
        id: generateId()
      });
      console.log(json)
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

  for (const unitData of timeUnits) {
    const { unit, seconds } = unitData;
    const value = Math.floor(remainingSeconds / seconds); // Calculate the value
    remainingSeconds %= seconds; // Update remaining seconds

    if (value > 0) {
      durationString += `${value} ${unit}${value !== 1 ? 's' : ''} `;
    }
  }

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

async function roomlist(ws, amount, emptyonly) {
  const roomsToSend = [];
  var count = 0;

  for (const [_, room] of serverData.rooms.entries()) {
    if (count > amount) {
      break;
    }

    if (room.players.size <= room.maxplayers || !emptyonly) {
      roomsToSend.push({
        roomName: room.name,
        roomId: room.id,
        roomversion: room.gameversion,
        playercount: room.players.size
      });

      count++;
    }
  }

  SendMessage(ws, JSON.stringify({ action: "roomlist_roominfo", rooms: roomsToSend }));
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

    const jsonData = {
      action: 'currentplayers',
      playerIds: playerIds,
      scene: room.scene,
      scenepath: room.scenepath,
      gameversion: room.gameversion,
      id: generateId()
    };

    SendMessage(player.socket, JSON.stringify(jsonData));
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

const MessagesToSend = new Map();

function SendMessage(ws, data) {
  let messages = MessagesToSend.get(ws);

  if (!messages) {
    messages = [];
    MessagesToSend.set(ws, messages);
  }

  messages.push(data);
}

async function sendBundledCompressedMessages() {
  for (const [socket, messages] of MessagesToSend) {
    if (getPlayerBySocket(socket) !== null) {
      const bundledMessage = messages.join('\n');

      try {
        const compressedData = await gzip(bundledMessage);
        socket.emit('clientmessage', compressedData);
      } catch (error) {
        console.error("Error compressing and sending message:", error);
      }
    }
  }

  MessagesToSend.clear();
}

setInterval(sendBundledCompressedMessages, 1000 / 30);

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    try {
      const decompressedmessage = await ungzip(message);
      const buffer = Buffer.from(decompressedmessage);
      const messagelist = buffer.toString('utf8').split("\n");

      for (const element of messagelist) {
        try {
          const data = JSON.parse(element);
          handleAction(ws, data);
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      }
    } catch (error) {
      console.error("Error decompressing message:", error);
    }
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