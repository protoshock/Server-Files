# Protoshock Server Files
This repository contains the files to run a Protoshock game server.
You can either run it directly if you clone this repo or use Docker.

## Required Modules:
- socket.io
- express
- dotenv
  
These can be installed just by typing ```npm install``` or ```yarn install``` depending on your package manager

> [!NOTE]
> If you are using docker the following packages are automatically installed.
## Running
```bash
node index.js
```

> [!NOTE]
> If you want to you can enable manually garbage collection by running with this flag ``node index.js --expose-gc``

## Info
Default port used is ``8880`` (TCP) but this can be changed in the enviroment config.

You can find the server's dashboard at ``http://[IP_ADDRESS]:[PORT]/`` or
``http://your.domain.com:[PORT]/``

For example the default server's dashboard is pointed at ``http://sevrer.bracketproto.com:8880/``

## Connecting to the Server

To connect to the server using Protoshock, follow these steps:

1. Open Protoshock.
2. Enter `http://[IP_ADDRESS]:[PORT]/` or `http://your.domain.com:[PORT]/` in the Server IP Input Area.
3. Click "Add Server".

After adding the server, locate the IP address or domain you just entered in the server list (you may need to use the scroll bar if your server list is extensive). Click on the entry to connect. If the server is correctly configured and the details were entered accurately, you should now be connected.

For instance, the default domain `server.bracketproto.com:8880` should already appear in the server list unless it was removed. Ensure it looks like this when adding your server.


## Using Docker

If you want to run the Protoshock server using Docker here is the simplest way to get it running
```bash
docker run -d -p 8880:8880 protoshock/protoshock-server:main
```

To enable manual garbage collection, change debug type, use https, change the port or manually set the country code (This is done automatically though) add the enviroment variables:
```bash
docker run -d -p 8880:8880 -e useHTTPS=true exposeGC=true debugType=full httpsCert='/path/to/ssl/certificate' httpsKey='/path/to/ssl/private_key' port=8880 protoshock/protoshock-server:main
```

If you prefer using Docker Compose you can use this configuration to get it running
```yml
version: '3'
services:
  protoshock-server:
    image: protoshock/protoshock-server:main
    container_name: Protoshock
    ports:
      - "8880:8880"
    restart: always
```

To enable manual garbage collection, change debug type, use https, change the port or manually set the country code (This is done automatically though) add this to the yaml file
```yml
    environment:
      - expostGC=true
      - debugType=full
      - useHTTPS=true
      - httpsCert='/path/to/ssl/certificate'
      - httpsKey='/path/to/ssl/private_key'
      - port=8880
      - countryCode=GB
```
