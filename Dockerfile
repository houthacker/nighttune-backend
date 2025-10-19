FROM node:24-alpine
LABEL org.opencontainers.image.authors="github.com/houthacker"

RUN apk add curl
RUN curl -fsS https://dotenvx.sh | sh
RUN npm install -g typescript

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build
CMD ["dotenvx", "run", "--convention=nextjs", "--", "node", "build/main.js"]
