FROM node:iron-alpine3.20
WORKDIR /usr/src/app
RUN apk --no-cache add git
RUN git clone https://github.com/protoshock/Server-Files.git .
RUN npm install --verbose --timeout=600000
ARG EXPOSE_GC=false
ENV EXPOSE_GC=$EXPOSE_GC
RUN chmod +x /usr/src/app/entryscript.sh
ENTRYPOINT ["/usr/src/app/entryscript.sh"]
EXPOSE 8880
