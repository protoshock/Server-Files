FROM node:18.18-alpine3.18
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
# If you are building your code for production
# RUN npm ci --omit=dev
COPY . .
EXPOSE 8880
CMD [ "node", "--expose-gc", "rewrite.mjs" ]