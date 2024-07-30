const { Server } = require('socket.io')
const { randomBytes } = require('crypto')
const { createGzip, createGunzip } = require('zlib')
const fs = require('fs')
const express = require('express')
const path = require('path')
const { finished } = require('stream/promises');
require('dotenv').config()
const app = express();
let server;
let messageInterval;

if (!process.env.countryCode) {
  async function getCountryCode() {
    try {
      const response = await fetch('http://ip-api.com/json');
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      const { countryCode } = data;
      const envFilePath = path.resolve(__dirname, '.env');
      let envFile = '';
      if (fs.existsSync(envFilePath)) {
        envFile = fs.readFileSync(envFilePath, 'utf8');
      }
      const addedCountryCode = envFile
        .split('\n')
        .filter(line => !line.startsWith(`countryCode=`))
        .concat(`countryCode=${countryCode}`)
        .join('\n');

      fs.writeFileSync(envFilePath, addedCountryCode);
      process.env.countryCode = countryCode
      if (process.env.debugType == 3) {
        console.log(`[Server] The current country code "${countryCode}" was added to the environment config for server selection usage.`);
      }
    } catch (error) {
      console.error('Error fetching country code:', error);
    }
  }
  getCountryCode();
}

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

if (!process.env.port) {
  console.log("[Warning] Port wasn't provided using default one.")
  process.env.port = 8880
}

if (process.env.useHTTPS === true) {
  if (!process.env.httpsCert) return console.log('[Error] useHTTPS is set to true but the certificate path is missing');
  if (!process.env.httpsKey) return console.log('[Error] useHTTPS is set to true but the certificate key path is missing');
  const { createServer } = require('https')
  server = createServer({
    cert: fs.readFileSync(process.env.httpsCert, 'utf8'),
    key: fs.readFileSync(process.env.httpsKey, 'utf8')
  }, app);
} else {
  const { createServer } = require('http')
  server = createServer(app);
}

app.use('/assets', express.static(path.join(__dirname, '/assets')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './views/index.html'));
});

app.get('/api/stats', (req, res) => {
  const roomsList = [];
  serverData.rooms.forEach((room) => {
    roomsList.push({
      RoomID: room.id,
      RoomName: room.name,
      RoomPlayerCount: room.playerCount,
      RoomPlayerMax: room.maxplayers,
      RoomGameVersion: room.gameversion,
    });
  });

  res.json({
    playerCount: getTotalPlayerCount(),
    memoryUsage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}mb`,
    countryCode: process.env.countryCode,
    uptime: formatUptime(Math.round(process.uptime())),
    rooms: roomsList || "",
    roomsCount: serverData.rooms.length || 0
  })
})

app.get('/ping', (req, res) => {
  res.status(200).json({ message: 'pong' });
})

const serverData = {
  players: new Map(),
  rooms: new Map(),
};

function createId() {
  let newId;
  do {
    newId = Array.from({ length: 4 }, () => randomBytes(4).toString('hex')).join('-');
  } while (serverData.players.has(newId));
  return newId;
}

function getPlayerBySocket(ws) {
  let foundPlayer;
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

function checkRoomValidity() {
  serverData.rooms.forEach((room, roomId) => {
    const invalidPlayers = [];

    room.players.forEach((player, playerId) => {
      // Get player info based on WebSocket
      const playerBySocket = getPlayerBySocket(player.socket);
      if (!playerBySocket || playerBySocket.id !== player.id) {
        invalidPlayers.push(playerId);
      }
    });

    // Remove invalid players and update player count
    invalidPlayers.forEach(playerId => {
      room.players.delete(playerId);
      room.playerCount--;
      console.log(`[Server] Player ${playerId} in Room ${roomId} is not valid. Removed from the room.`);
    });

    if (room.playerCount <= 0) {
      serverData.rooms.delete(roomId);
    }
  });
}

setInterval(checkRoomValidity, 10000);

function joinRoom(ws, roomId, _gameversion, ishosting) {
  const player = getPlayerBySocket(ws);
  if (player && player.roomId) {
    if (process.env.debugType >= 2) return console.log(`[Server] Player ${player.id} is already in a room: ${player}`);
  }
  const room = serverData.rooms.get(roomId);
  if (!room) return;
  if (room.gameversion != _gameversion) return;
  const newPlayer = {
    id: createId(),
    socket: ws,
    roomId: roomId,
    local: true,
    hosting: ishosting
  };
  room.players.set(newPlayer.id, newPlayer);
  serverData.players.set(newPlayer.id, newPlayer);
  room.playerCount++;
  if (process.env.debugType === 3) {
    console.log(`[Server] Player ${newPlayer.id} joined the room ${newPlayer.roomId}`);
    console.log(`[Server] Room ${roomId}'s Player Count: ${room.playerCount}`);
  }
  broadcastRoomInfo();
}

function createRoom(ws, roomName, _scene, _scenepath, _gameversion, max) {
  const player = getPlayerBySocket(ws);
  if (player && player.roomId) {
    if (process.env.debugType >= 2) return console.log(`[Server] Player ${player.id} is already in a room.`);
  }
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
  joinRoom(ws, room.id, _gameversion, true);
}

async function removePlayer(ws) {
  const player = getPlayerBySocket(ws);
  if (!player) return;
  const room = serverData.rooms.get(player.roomId);
  if (!room) return console.error("[Debug] Room not found.");
  if (player.hosting && room.players.size > 1) {
    const players = Array.from(room.players.values());
    if (!Array.isArray(players)) {
      console.error("[Debug] Players is not an array.");
      return;
    }
    let nextPlayer;
    for (const playerobject of players) {
      if (playerobject !== player) {
        nextPlayer = playerobject;
        break;
      }
    }
    if (nextPlayer) {
      var data = JSON.stringify({
        type: "newhost",
        newhostid: nextPlayer.id
      });
      nextPlayer.hosting = true;
      try {
        players.forEach((playertosend) => {
          if (playertosend !== player) {
            let json = JSON.stringify({
              action: 'rpc',
              rpc: data,
              sender: createId(),
              id: createId(),
            });
            SendMessage(playertosend.socket, json);
          }
        });
      } catch (error) {
        console.error("[Debug] Error sending RPC:", error);
      }
    }
  }

  serverData.players.delete(player.id);
  room.players.delete(player.id);
  room.playerCount--;
  if (room.playerCount == 0) {
    serverData.rooms.delete(room.id);
  }

  if (process.env.debugType === 3) return console.log(`[Server] Player ${player.id} left from the room ${player.roomId}`);
  if (process.env.debugType === 3) return console.log(`[Server] Room ${player.roomId}'s Player Count: ${room.playerCount}`);

  if (serverData.rooms.size === 0) {
    clearInterval(messageInterval);
  }
}

function scheduleGc() {
  if (!global.gc) return;
  var minutes = Math.random() * 30 + 15;
  setTimeout(function () {
    global.gc();
    if (process.env.debugType === 3) return console.log('[Debug] Garbage Collector was ran.');
    scheduleGc();
  }, minutes * 60 * 1000);
}

scheduleGc();

function broadcastRoomInfo() {
  serverData.players.forEach((player) => {
    if (player == null) return;
    const room = serverData.rooms.get(player.roomId);
    if (!room) return;
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

async function handleRPC(ws, data) {
  let player = getPlayerBySocket(ws)
  if (player == null) return;
  let players = getPlayersInRoom(player.roomId);
  players.forEach((p) => {
    let parsedData = JSON.parse(data);
    const _data = JSON.stringify({
      action: parsedData.action,
      rpc: parsedData.rpc,
      sender: parsedData.sender,
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
  if (serverData.rooms.size < 0) return;
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
  if (!room) return;
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
      joinRoom(ws, data.roomId, data.gameversion, false);
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
      if (socket) {
        const gzip = createGzip();
        const buffers = [];
        gzip.on('data', (chunk) => buffers.push(chunk));
        gzip.on('end', () => {
          const compressedData = Buffer.concat(buffers);
          socket.emit('clientmessage', compressedData);
        });
        gzip.on('error', (error) => {
          console.error("[Error] There was a issue compressing the bundled messages:", error);
        });
        gzip.end(bundledMessage);
      }
    } catch (error) {
      console.error("Error compressing and sending message:", error);
    }
  });
  MessagesToSend.clear();
}

const connectedWebClients = new Map();
const MessagesToSend = new Map();

function startInterval() {
  messageInterval = setInterval(sendBundledCompressedMessages, 1000 / 30);
}

const wss = new Server(server, {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10e8,
  pingTimeout: 60000
});

setInterval(() => {
  if (connectedWebClients.size > 0) {
    const roomsList = [];
    serverData.rooms.forEach((room) => {
      roomsList.push({
        RoomID: room.id,
        RoomName: room.name,
        RoomPlayerCount: room.playerCount,
        RoomPlayerMax: room.maxplayers,
        RoomGameVersion: room.gameversion,
      });
    });

    connectedWebClients.forEach((client) => {
      const data = {
        rooms: roomsList,
        playerCount: getTotalPlayerCount(),
        uptime: convertSecondsToUnits(Math.round(process.uptime())),
        memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
      };
      client.emit("webClient", data);
    })
  }
}, 1000);

wss.on('connection', (ws) => {
  ws.on('message', async (compressedMessage) => {
    try {
      const gunzip = createGunzip();
      const chunks = [];
      gunzip.on('data', (chunk) => {
        chunks.push(chunk);
      });
      gunzip.write(compressedMessage);
      gunzip.end();
      await finished(gunzip);
      const decompressedMessage = Buffer.concat(chunks).toString('utf8');
      const messageList = decompressedMessage.split('\n');
      const filteredMessageList = messageList.filter(msg => msg.trim() !== '');

      filteredMessageList.forEach((element) => {
        try {
          const data = JSON.parse(element);
          handleAction(ws, data);
        } catch (err) {
          console.error("Error parsing message:", err);
        }
      });
    } catch (err) {
      console.error('[Error] Failed Decompressing the Message sent from Client', err)
    }
  });

  ws.on('ping', (timestamp) => {
    ws.volatile.emit('pong', timestamp);
    let player = getPlayerBySocket(ws);
    if (player != null) {
      player.lastMessageTime = Date.now();
    }
  });

  ws.on('webClient', () => {
    connectedWebClients.set(ws, ws);
    if (process.env.debugType === 3) return console.log("[Server] Web Client Connected");
  });

  ws.on('disconnect', () => {
    if (connectedWebClients.has(ws)) {
      connectedWebClients.delete(ws);
      if (process.env.debugType === 3) return console.log("[Server] Web Client Removed");
    } else {
      removePlayer(ws);
    }
  });
});

server.listen(process.env.port, () => {
  console.log(`[Server] Listening on port ${process.env.port} ${process.env.useHTTPS === 'true' ? 'using https ' : ''}${process.env.debugType ? `and debug set to ${process.env.debugType}` : ''}`);
});