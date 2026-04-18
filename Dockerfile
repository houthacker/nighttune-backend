FROM node:22-bullseye-slim AS builder
LABEL org.opencontainers.image.authors="github.com/houthacker"

# We want bash
SHELL [ "/bin/bash", "-c" ]

# Install packages required for building
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       git sudo python3 build-essential ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN git clone --branch v0.7.1 https://github.com/openaps/oref0.git /autotune/oref0

# Install oref0 binaries
WORKDIR /autotune/oref0
RUN npm run global-install

# Install app dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bullseye-slim AS runtime
LABEL org.opencontainers.image.authors="github.com/houthacker"

EXPOSE 3333
SHELL [ "/bin/bash", "-c" ]

# Install packages required for running
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates sqlite3 jq bc \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app /app
COPY --from=builder /autotune/oref0 /autotune/oref0
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=builder /usr/local/bin /usr/local/bin

# Move the .sqliterc file to the home directory
RUN mv /app/.sqliterc ~/

# Set the default shell to bash
RUN chsh -s /bin/bash

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

# The SHELL env var is required to run autotune.
ENV SHELL='/bin/bash'

ENTRYPOINT [ "/app/scripts/entrypoint.sh" ]
