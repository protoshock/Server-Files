# Server-Files
This repository contains the files to run a Protoshock game server.
You can either run it directly if  you clone this repo or use Docker

# Required Modules:
- socket.io
- node-gzip
- express
  
These can be installed just by typing npm i or yarn i depending on your package manager

> [!NOTE]
> If you’re running this on Docker there is no need to install these dependencies

## Running
```
node --expose-gc index.mjs
```

# Info
Default port is ``8880`` (TCP)

You can find a website for the server's status at ``http://[IP_ADRESS]:[PORT]/`` or
``http://your.domain.com:[PORT]/``

# Connecting to the Server

To change the server you’re connected to, go to your Protoshock installation directory then edit ``/Networking/NetworkSettings.json`` and after ``"server_ip":`` add your own domain or IP and the port at the end. For example ``"server.bracketproto.com:8880"`` which is the default domain.

# Using Docker

If you want to run the Protoshock server using Docker here is the simplest way to get it running
``docker run -d -p 8880:8880 gizzyuwu/protoshock:main``
