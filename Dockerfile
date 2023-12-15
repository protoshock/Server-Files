FROM node:18.18-alpine3.18
WORKDIR /usr/src/app
RUN apk --no-cache add git
RUN git clone https://github.com/protoshock/Server-Files.git .
RUN npm install
ARG EXPOSE_GC=false
ENV EXPOSE_GC=$EXPOSE_GC
CMD ["node", "index.mjs", "${EXPOSE_GC === 'true' ? '--expose-gc' : ''}"]
EXPOSE 8880
