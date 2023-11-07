FROM node:18.18-alpine3.18
WORKDIR /usr/src/app
RUN apk --no-cache add git
RUN git clone https://github.com/protoshock/Server-Files.git /usr/src/app
CMD ["node" + "--expose-gc" + "index.mjs"]
EXPOSE 8880