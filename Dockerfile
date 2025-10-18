FROM node:24-alpine
LABEL org.opencontainers.image.authors="github.com/houthacker"

WORKDIR /nighttune
COPY . .
RUN npm install -g
CMD ["/bin/sh", "-c", "nighttune"]
