const socket = io();
const displayelement = document.getElementById("display");
var i = 0;
var usagehistory = [0, 8000];
var playerhistory = [0, 5];
var time = [0, 0];
var ping = 0;
var isPaused = false;
var chartToggle;

socket.emit("webClient");

socket.on("pong", (timestampdata) => {
    var d = new Date();
    var currentMilliseconds = d.getMilliseconds();
    ping = currentMilliseconds - timestampdata;
});

socket.on('webClient', (data) => {
    var d = new Date();
    var currentMilliseconds = d.getMilliseconds();
    socket.emit("ping", currentMilliseconds);
    const rooms = data.rooms;
    const playercount = data.playerCount;
    const Uptime = data.uptime;
    const Usage = data.memoryUsage;
    usagehistory.push(Usage);
    playerhistory.push(playercount);
    time.push(i);
    while (usagehistory.length > 25) {
        usagehistory.shift();
        playerhistory.shift();
        time.shift();
        usagehistory[0] = 0;
        playerhistory[0] = 0;
        usagehistory[1] = 8000;
        playerhistory[1] = 5;
    }

    displayelement.innerHTML = '';

    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    statsContainer.style.fontSize = '15px'; // Default font size for initial load

    statsContainer.innerHTML = `
        <p>Uptime: ${Uptime}</p>
        <p>Players Online: ${playercount}</p>
        <p>Memory Usage: ${Usage}mb</p>
        <p>Ping: <span style="color: ${ping < 50 ? 'rgb(0, 255, 0)' : ping < 100 ? 'yellow' : 'red'}">${ping}ms</span></p>
    `;

    displayelement.appendChild(statsContainer);

    const chartContainer = document.createElement('div');
    chartContainer.className = 'container'; // Ensure the container uses the flex layout

    const memoryChartContainer = document.createElement('div');
    memoryChartContainer.className = 'chart-container';
    const memoryCanvas = document.createElement('canvas');
    memoryCanvas.className = 'graph';
    memoryCanvas.id = 'Memory';
    memoryChartContainer.appendChild(memoryCanvas);
    chartContainer.appendChild(memoryChartContainer);

    const playerCountChartContainer = document.createElement('div');
    playerCountChartContainer.className = 'chart-container';
    const playerCountCanvas = document.createElement('canvas');
    playerCountCanvas.className = 'graph';
    playerCountCanvas.id = 'playerCount';
    playerCountChartContainer.appendChild(playerCountCanvas);
    chartContainer.appendChild(playerCountChartContainer);

    displayelement.appendChild(chartContainer);

    const roomList = document.createElement('div');
    roomList.className = 'room-list';
    if (rooms.length === 0) {
        const noRoomsDiv = document.createElement('div');
        noRoomsDiv.className = 'room';
        noRoomsDiv.innerHTML = '<p>No rooms</p>';
        roomList.appendChild(noRoomsDiv);
    } else {
        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room';
            roomDiv.innerHTML = `<p>Room ID: ${room.RoomID} | Version: ${room.RoomGameVersion} | Room Name: ${room.RoomName} Player Count: ${room.RoomPlayerCount}/${room.RoomPlayerMax}</p>`;
            roomList.appendChild(roomDiv);
        });
    }

    displayelement.appendChild(roomList);

    new Chart(document.getElementById("Memory"), {
        type: 'line',
        data: {
            labels: time,
            datasets: [{
                data: usagehistory,
                label: "Memory Usage",
                borderColor: "#00ffff",
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            title: {
                display: true,
                text: 'Server Stats'
            }
        }
    });

    new Chart(document.getElementById("playerCount"), {
        type: 'line',
        data: {
            labels: time,
            datasets: [
                {
                    data: playerhistory,
                    label: "Player count",
                    borderColor: "#ff0000",
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            title: {
                display: true,
                text: 'Player Graph'
            }
        }
    });

    i++;
});
