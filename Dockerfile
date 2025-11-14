FROM node:25-trixie-slim
LABEL org.opencontainers.image.authors="github.com/houthacker"

RUN chsh -s /usr/bin/bash
RUN apt-get update && apt-get install -y curl git sudo bash sqlite3 python3 build-essential jq bc && apt-get clean
RUN npm config --shell bash

RUN git clone --branch v0.7.1 https://github.com/openaps/oref0.git /autotune/oref0
RUN curl -fsS https://dotenvx.sh | bash

WORKDIR /autotune/oref0
RUN npm run global-install

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build
CMD ["npm", "start"]
