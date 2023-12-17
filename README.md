# Server-Files
This repository contains the files to run a Protoshock game server.
You can either run it directly if you clone this repo or use Docker

# Required Modules:
- socket.io
- node-gzip
- express
- dotenv
  
These can be installed just by typing npm install or yarn install depending on your package manager

> [!NOTE]
> If you’re running this on Docker there is no need to install these dependencies

## Running
```bash
node index.js
```

> [!NOTE]
> If you want to you can run with --expose-gc to manually clear garbage

# Info
Default port is ``8880`` (TCP)

You can find a website for the server's status at ``http://[IP_ADDRESS]:[PORT]/`` or
``http://your.domain.com:[PORT]/``

# Connecting to the Server

To change the server you’re connected to, go to your Protoshock installation directory then edit ``/Networking/NetworkSettings.json`` and after ``"server_ip":`` add your own domain or IP and the port at the end.

For example ``"server.bracketproto.com:8880"`` which is the default domain.

# Using Docker

If you want to run the Protoshock server using Docker here is the simplest way to get it running
```bash
docker run -d -p 8880:8880 protoshock/protoshock-server:main
```

To enable expose-gc add the enviroment variable EXPOSE_GC
```bash
docker run -d -p 8880:8880 -e EXPOSE_GC=true protoshock/protoshock-server:main
```

If you prefer Docker Compose you can use this
```yml
version: '3'
services:
  protoshock-server:
    image: protoshock/protoshock-server:main
    container_name: Protoshock-Server
    ports:
      - "8880:8880"
    restart: always
```

To enable expose-gc add this to the yml file
```yml
    environment:
      - EXPOSE_GC=true
```
