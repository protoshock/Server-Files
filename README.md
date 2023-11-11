# Server-Files
This respository contains the files to run a Protoshock game server using Docker.

# Requied Modules:
- npm i socket.io
- npm i node-gzip
- npm i express

>[!info]
>If you’re running this on Docker there is no need to install these dependencies

## When trying to start run like this [DEPRICATED]
```
node --expose-gc index.mjs
```

# Info
Default port is ``8880`` (TCP)

You can find a website for the server's status at ``http://[IP_ADRESS]:[PORT]/`` or
``http://your.domain.com:[PORT]/``

# Connecting to the Server

To change the server you’re connected to, go to your Protoshock installation directory then ``/Networking/NetworkSettings.json`` and after  ``"server_ip": `` with your own domain or IP and the port at the end. For example ``"server.bracketproto.com:8880"`` which is the default domain.

# Using Docker

If you want to run the Protoshock server using Docker here is the simplest way to get it running
``Docker run command here but no image on docker hub yet``
