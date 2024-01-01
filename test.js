const io = require('socket.io-client');
const ss = require('socket.io-stream');
const { gzip, ungzip } = require('node-gzip');
const fs = require('fs');

const socket = io('http://localhost:8880');

socket.on('connect', () => {
  console.log('Connected to server');
  runTest2();
  runTest();
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

ss(socket).on('filestream', (stream) => {
  console.log('Receiving stream...');
  const fileStream = fs.createWriteStream('ps_testmap-5wym.zip');
  stream.pipe(fileStream);
  stream.on('end', () => {
    console.log('Stream received successfully');
  });
});

socket.on('listMods', async (data) => {
  try {
    const decompressedData = await ungzip(data);
    const jsonData = JSON.parse(decompressedData);
    console.log(jsonData);
  } catch (error) {
    console.error('Error parsing data:', error);
  }
});

socket.on('streamErr', (e) => {
  console.log('Stream Error:', e.error);
  socket.disconnect();
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  socket.disconnect();
});

async function runTest() {
  try {
    const actionData = {
      action: 'getMod',
      modname: 'ps_testmap-5wym.zip'
    };
    const jsonData = JSON.stringify(actionData);
    const compressed = await gzip(jsonData);
    socket.emit('message', compressed);
  } catch (error) {
    console.error('Error in runTest:', error);
  }
}

async function runTest2() {
  try {
    const actionData = {
      action: 'listMods'
    };
    const jsonData = JSON.stringify(actionData);
    const compressed = await gzip(jsonData);
    socket.emit('message', compressed);
  } catch (error) {
    console.error('Error in runTest2:', error);
  }
}