const socket = io();
const displayelement = document.getElementById("display");
var i = 0;
var usagehistory = [0, 8000];
var playerhistory = [0, 5];
var time = [0, 0];
var ping = 0;
socket.emit("webmessage");
socket.on("pong", (timestampdata) => {
    var d = new Date();
    var currentMilliseconds = d.getMilliseconds();
    ping = currentMilliseconds - timestampdata;
});

socket.on('webmessageclient', (data) => {
    var currentMilliseconds = new Date().getMilliseconds();
    socket.emit("ping", currentMilliseconds);
    const rooms = data.rooms;
    const playercount = data.globalplayercount;
    const Uptime = data.uptime;
    const Usage = data.usage;
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
    var roomtext = "";
    rooms.forEach(room => {
        roomtext = roomtext + `<div class='room'><p>Room ID: ${room.RoomID} | Version: ${room.RoomGameVersion} | Room Name: ${room.RoomName} Player Count: ${room.RoomPlayerCount}/${room.RoomPlayerMax}</p></div><br/>`
    });
    if (rooms.length == 0) {
        roomtext = "<div class='room'><p>No rooms</p></div><br/></div>";
    }

    var pingtext = "";
    if (ping < 50) {
        pingtext = "<p>Ping: </p><p class='good'>" + ping + "ms</p>"
    } else {
        if (ping > 50 && ping < 100) {
            pingtext = "<p>Ping: </p><p class='medium'>" + ping + "ms</p>"
        }
        else {
            pingtext = "<p>Ping: </p><p class='bad'>" + ping + "ms</p>"
        }
    }

    displayelement.innerHTML = `<div class="divround" style='width: 800px;'><div class='infotext'><p>Uptime: ${Uptime}<p><p>Total Players Online: ${playercount}</p><p>Memory Usage: ${Usage}mb<p>${pingtext}</div><div class='container'><canvas class='graph' id='Memory'></canvas><canvas class='graph2' id='Player Count'></canvas></div>${roomtext}</div>`

    // Charts
    new Chart(document.getElementById("Memory"), {
        type: 'line',
        data: {
            labels: time,
            datasets: [{
                data: usagehistory,
                label: "Memory Usage",
                borderColor: "#00ffff",
                fill: false
            }
            ]
        },
        options: {
            animation: {
                duration: 0
            },
            title: {
                display: true,
                text: 'Server Resources'
            },
        }
    });
    new Chart(document.getElementById("Player Count"), {
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
            animation: {
                duration: 0
            },
            title: {
                display: true,
                text: 'Server Stats'
            },
        }
    });

    i++;
});