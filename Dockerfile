FROM node:25-trixie-slim
LABEL org.opencontainers.image.authors="github.com/houthacker"

# Express listens on port 3333
EXPOSE 3333

# We want to use bash instead of sh.
SHELL [ "/usr/bin/bash", "-c" ]

# Install required packages
RUN apt-get update && apt-get install -y curl git sudo bash sqlite3 python3 build-essential jq bc && apt-get clean

RUN git clone --branch v0.7.1 https://github.com/openaps/oref0.git /autotune/oref0
RUN curl -fsS https://dotenvx.sh | bash

# Install oref0 binaries
WORKDIR /autotune/oref0
RUN npm run global-install

# Install app dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Move the .sqliterc file to the home directory
RUN mv .sqliterc ~/

# Can be overridden using --build-arg NT_VERSION=..., NT_DB_PATH=..., etc
# These are required by scripts/build-image.sh
ARG NT_VERSION=unknown
ARG NT_DB_PATH
ARG DOTENV_CONFIG_PATH

# When running from Docker, a production env is assumed.
# If another environment is necessary, run nighttune-backend from 
# source using for example "npm run dev".
ENV NODE_ENV=production

# The full path to the database file. Must be set before first running
# the container, because it is used to initialize the database before
# the application runs.
ENV NT_DB_PATH=${NT_DB_PATH}

# The nighttune version; for display only
ENV NT_VERSION=${NT_VERSION}

# The full path to the .env file. 
ENV DOTENV_CONFIG_PATH=${DOTENV_CONFIG_PATH}

# Build nighttune-backend
RUN npm run build

ENTRYPOINT [ "/app/scripts/entrypoint.sh" ]
