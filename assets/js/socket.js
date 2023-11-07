const socket = io();
            const displayelement = document.getElementById("display");
            let i = 0;
            let usagehistory = [0, 8000];
            let playerhistory = [0, 5];
            let time = [0,0];
            let ping = 0;
            socket.emit("webmessage");
            socket.on("pong", (timestampdata) =>{
                let d = new Date();
                let currentMilliseconds = d.getMilliseconds();
                ping = currentMilliseconds - timestampdata;
            });
            function formatTime(inputTime) {
  const parts = inputTime.split(' ');

  if (parts.length < 2 || parts.length % 2 !== 0) {
    return 'Invalid time format';
  }

  let duration = {
    y: 0,
    m: 0,
    w: 0,
    d: 0,
    h: 0,
    min: 0,
    mins: 0,
    s: 0,
  };

  for (let i = 0; i < parts.length; i += 2) {
    const value = parseInt(parts[i]);
    const unit = parts[i + 1];

    if (isNaN(value)) {
      return 'Invalid time format';
    }

    switch (unit) {
      case 'years':
      case 'year':
        duration.y = value;
        break;
      case 'months':
      case 'month':
        duration.m = value;
        break;
      case 'weeks':
      case 'week':
        duration.w = value;
        break;
      case 'days':
      case 'day':
        duration.d = value;
        break;
      case 'hours':
      case 'hour':
        duration.h = value;
        break;
      case 'minutes':
        duration.mins = value;
        break;
      case 'minute':
        duration.min = value;
        break;
      case 'seconds':
      case 'second':
        duration.s = value;
        break;
      default:
        return 'Invalid time unit';
    }
  }

  const formattedTime = Object.entries(duration)
    .filter(([unit, value]) => value > 0)
    .map(([unit, value]) => `${value}${unit}`)
    .join(' ');

  return formattedTime;
}


            socket.on('webmessageclient', (data) => {
              if (i > 0) {
                document.getElementById("Memory").remove();
                document.getElementById("Player Count").remove();
            }
            
                let d = new Date();
                let currentMilliseconds = d.getMilliseconds();
                socket.emit("ping", currentMilliseconds);
                const rooms = data.rooms;
                const playercount = data.globalplayercount;
                const Uptime = data.uptime
                const formattedTime = formatTime(Uptime);
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
                let roomtext = "";
                let pingtext = "";
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                rooms.forEach(room => {
                    roomtext = roomtext 
                    + `<div class='room'><a href="${room.RoomID}"><p class='room-text' style="color: white"> Room ID: ${room.RoomID}`
                    + ` | Version: ${room.RoomGameVersion}`
                    + ` | Room Name: ${room.RoomName}`
                    + ` | Player Count: ${room.RoomPlayerCount}/${room.RoomPlayerMax}`
                    + `</p></a></div>`;
                });
                if(rooms.length == 0){
                    roomtext = "<div class='room'><p class='room-text' style='color: white'>No rooms</p></div><br/></div>";
                }
              } else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)  {
                rooms.forEach(room => {
                  roomtext = roomtext 
                  + `<div class='room'><a href="${room.RoomID}"><p class='room-text' style="color: black"> Room ID: ${room.RoomID}`
                  + ` | Version: ${room.RoomGameVersion}`
                  + ` | Room Name: ${room.RoomName}`
                  + ` | Player Count: ${room.RoomPlayerCount}/${room.RoomPlayerMax}`
                  + `</p></a></div>`;
              });
              if(rooms.length == 0){
                  roomtext = "<div class='room'><p class='room-text' style='color: black'>No rooms</p></div><br/></div>";
              }
              } else {
                rooms.forEach(room => {
                  roomtext = roomtext 
                  + `<div class='room'><a href="${room.RoomID}"><p class='room-text' style="color: white"> Room ID: ${room.RoomID}`
                  + ` | Version: ${room.RoomGameVersion}`
                  + ` | Room Name: ${room.RoomName}`
                  + ` | Player Count: ${room.RoomPlayerCount}/${room.RoomPlayerMax}`
                  + `</p></a></div>`;
              });
              if(rooms.length == 0){
                  roomtext = "<div class='room'><p class='room-text' style='color: white'>No rooms</p></div><br/></div>";
              }
              }

              if(ping < 50){
                pingtext = `<span class='good' style="color: green">${ping}ms</span>`
            } 
            else{
                if(ping > 50 && ping < 100){
                    pingtext = `<span class='medium' style="color: yellow">${ping}ms</span`
                }
                else{
                    pingtext = `<span class='bad' style="color: red">${ping}ms</span>`
                }
            }
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  document.getElementById('server-uptime').innerHTML = formattedTime;
                  document.getElementById('player-count').innerHTML = playercount;
                  document.getElementById('memory-usage').innerHTML = Usage + 'mb';
                  document.getElementById('server-uptime').style.color = "white"
                  document.getElementById('player-count').style.color = "white"
                  document.getElementById('memory-usage').style.color = "white"
                  document.getElementById('room').innerHTML = roomtext;
                  document.getElementById('server-ping').innerHTML = pingtext;
                } else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                  document.getElementById('room').innerHTML = roomtext;
                  document.getElementById('server-ping').innerHTML = pingtext;
                document.getElementById('server-uptime').innerHTML = formattedTime;
                document.getElementById('player-count').innerHTML = playercount;
                document.getElementById('memory-usage').innerHTML = Usage + 'mb';
                } else {
                  document.getElementById('server-uptime').innerHTML = formattedTime;
                  document.getElementById('player-count').innerHTML = playercount;
                  document.getElementById('memory-usage').innerHTML = Usage + 'mb';
                  document.getElementById('server-uptime').style.color = "white"
                  document.getElementById('player-count').style.color = "white"
                  document.getElementById('memory-usage').style.color = "white"
                  document.getElementById('room').innerHTML = roomtext;
                  document.getElementById('server-ping').innerHTML = pingtext;
                }
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
                  const newColorScheme = event.matches ? "dark" : "light";
                  if(newColorScheme === "dark") {
                    document.getElementById('server-uptime').innerHTML = formattedTime;
                    document.getElementById('player-count').innerHTML = playercount;
                    document.getElementById('memory-usage').innerHTML = Usage + 'mb';
                    document.getElementById('server-uptime').style.color = "white"
                    document.getElementById('player-count').style.color = "white"
                    document.getElementById('memory-usage').style.color = "white"
                    document.getElementById('room').innerHTML = roomtext;
                    document.getElementById('server-ping').innerHTML = pingtext;
                  } else if(newColorScheme === 'light') {
                    document.getElementById('room').innerHTML = roomtext;
                    document.getElementById('server-ping').innerHTML = pingtext;
                  document.getElementById('server-uptime').innerHTML = formattedTime;
                  document.getElementById('player-count').innerHTML = playercount;
                  document.getElementById('server-uptime').style.color = "#344767"
                  document.getElementById('player-count').style.color = "#344767"
                  document.getElementById('memory-usage').style.color = "#344767"
                  document.getElementById('memory-usage').innerHTML = Usage + 'mb';
                  }
                });
            });

window.addEventListener('beforeunload', () => {
  socket.close();
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
  const newColorScheme = event.matches ? "dark" : "light";
});
