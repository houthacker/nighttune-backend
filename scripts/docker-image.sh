#!/usr/bin/env bash

# Ensure required tools are present.
command -v git >/dev/null 2>&1 || { echo >&2 "Aborting build because the required 'git' command cannot be found."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo >&2 "Aborting build because the required 'docker' command cannot be found."; exit 1; }

ME="${0}"
PROJECT_ROOT=$(realpath $(dirname $(readlink -f ${ME}))/..)

show_usage () {
    cat <<EOF
NAME
${ME} - Build a docker image running the Nighttune backend

SYNOPSIS
${ME} [--help] OR [--db-path <path>] [--dotenv <path>] [--prepare <path>]

DESCRIPTION
Creates a docker image for nighttune-backend. Run this script with the
following options and/or environment variables to configure it.

OPTIONS
-d | --db-path <path>       - The absolute path to the nighttune database. It must reside in the '/data' directory, and any
                              subdirectories must have been created prior to building this image.
                              If not set, it defaults to '/data/nighttune-backend-prod.db'.

-e | --dotenv <path>        - The absolute path to the .env file. It must reside in the '/config' directory, and any 
                              subdirectories must have been created prior to building this image.
                              If not set, it defaults to '/config/.env'.

-h | --help                 - Display this usage description.

-o | --prepare-only <path>  - Same as --prepare, but exit immediately after the preparation has finished.

-p | --prepare <path>       - Prepare a directory structure containing example configuration files in the given path.
                              Note that the given path must *not* exist, otherwise preparation will not continue.

NOTE
If the database doesn't exist, it will be created when the container boots. 
Otherwise, only changes that have not yet been applied to the database are executed. 
Any pre-existing data are migrated if necessary.

EXAMPLE
* To create a docker image using the default database path and a custom env-file location:
$ ${ME} --dotenv /config/your/sub/directory/.env

* To create a docker image using default options while preparing a directory structure in for example '~/nighttune-docker':
$ ${ME} --prepare ~/nighttune-docker

This results in the following directories and files being set up:
~/nighttune-docker/
├─ data/
├─ config/
|   ├─ .env
├─ compose.yaml

EOF

    exit 0
}

prepare_directories () {
    if [ -z "$1" ]; then
        echo "Error while preparing directory structure: missing mandatory path parameter, aborting."
        exit 1
    elif [ -d "$1" ]; then
        echo "Error while preparing directory structure: directory $1 already exists, aborting."
        exit 1
    fi

    mkdir -p "$1/data"
    mkdir "$1/config"

    cp ${PROJECT_ROOT}/examples/compose.example.yaml "$1/compose.yaml"
    cp ${PROJECT_ROOT}/examples/.env.example "$1/config/.env"
}

require_docker_running () {
    docker info &> /dev/null
    if [ "$?" -ne 0 ]; then
        # Check known socket paths, including WSL2 Docker Desktop locations.
        if [ ! -e '/var/run/docker.sock' ] && \
           [ ! -e "${HOME}/.docker/desktop/docker.sock" ] && \
           [ ! -e '/mnt/wsl/docker-desktop/shared-sockets/guest-services/backend.sock' ]; then
            if grep -qi microsoft /proc/version 2>/dev/null; then
                echo >&2 "Docker seems not to be running. If you are using Docker Desktop on Windows, ensure WSL integration is enabled for this distro in Docker Desktop settings (Settings > Resources > WSL Integration)."
            else
                echo >&2 "Docker seems not to be running, please start it first."
            fi
        else
            echo >&2 "Could not successfully retrieve docker status, please ensure it is running without error."
        fi

        exit 1
    fi
}

build_docker_image () {
    CURRENT_DIR=$(pwd)

    cd ${PROJECT_ROOT}

    echo "Building Docker image for nighttune-backend. Configured environment variables are:"
    echo "- NT_VERSION=${NT_VERSION}"
    echo "- NT_DB_PATH=${NT_DB_PATH}"
    echo "- DOTENV_CONFIG_PATH=${DOTENV_PATH}"
    docker buildx build \
        --quiet \
        --build-arg NT_VERSION=${NT_VERSION} \
        --build-arg NT_DB_PATH=${NT_DB_PATH} \
        --build-arg DOTENV_CONFIG_PATH=${DOTENV_PATH} \
        --label org.opencontainers.image.licenses=GPL-3.0 \
        --label org.opencontainers.image.version=${NT_VERSION} \
        -t nighttune-backend:${NT_VERSION} \
        -t nighttune-backend:latest \
        ${PROJECT_ROOT}
    
    build_status=$?

    cd ${CURRENT_DIR}
    if [ "${build_status}" -ne 0 ]; then
        echo >&2 "Error while building docker image, aborting."
        return 1
    else
        echo "Image created."
        echo

        if [ -z "${PREPARE_DIR}" ]; then
            echo "Next steps:"
            echo "1. Ensure the following directory structure exists in a new folder of your choosing (.e.g. ~/nighttune-docker):"
            echo
            echo "~/nighttune-docker/"
            echo "├─ data/"
            echo "├─ config/"
            echo
            echo "2. Copy 'examples/.env.example' to ~/nighttune-docker/config/.env and edit it to your needs."
            echo "3. If you use docker compose, copy 'examples/compose.example.yaml' to ~/nighttune-docker/compose.yaml and edit it to your needs."
            echo "4. Start the container: cd ~/nighttune-docker && docker compose up -d"
        else
            echo "Next steps:"
            echo "1. Edit the .env file and optionally the docker compose file to suit your needs."
            echo "2. Start the container: cd ${PREPARE_DIR} && docker compose up -d"
        fi
    fi
}

# We require a running docker daemon to continue.
require_docker_running

# Set configuration default values
NT_VERSION=$(git describe --tags $(git rev-list --tags --max-count=1))
NT_DB_PATH='/data/nighttune-backend-prod.db'
DOTENV_PATH='/app/.env'
PREPARE_DIR=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -e | --dotenv)
            DOTENV_PATH="$2"
            shift
            shift
            ;;
        -d | --db-path)
            NT_DB_PATH="$2"
            shift
            shift
            ;;
        -h | --help)
            show_usage
            shift
            ;;
        -p | --prepare)
            prepare_directories "$2"
            PREPARE_DIR="$2"
            shift
            shift
            ;;
        -o | --prepare-only)
            prepare_directories "$2"
            exit 0
            ;;
        -*|--*)
            echo "Unknown parameter '$1'"
            exit 1
    esac
done

build_docker_image
