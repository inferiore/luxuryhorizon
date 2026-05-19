FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json ./
RUN npm install --production

COPY server.js schema.sql ./

RUN mkdir -p data

EXPOSE 3100
CMD ["node", "server.js"]
