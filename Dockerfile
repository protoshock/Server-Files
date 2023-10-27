FROM node:18.18-alpine3.18
WORKDIR /usr/src/app
RUN apk --no-cache add git
COPY entrypoint.sh /usr/src/app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
EXPOSE 8880
