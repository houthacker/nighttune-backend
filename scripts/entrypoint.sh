#!/usr/bin/env bash

# Exit immediately on error
set -e

MANDATORY_ENV_VARS=(
    NODE_ENV
    NT_DB_PATH
)

check_env () {
    for v in ${MANDATORY_ENV_VARS[@]}; 
    do
        if [ -z "${!v}" ]; then
            echo "Missing mandatory environment variable '$v' in docker container environment; aborting" >&2
            return 1
        fi
    done
}

check_env

# Initialize or upgrade the database.
source /app/scripts/initdb.sh ${NT_DB_PATH} /app/src/config/db.sql

# Finally, start the app.
exec npm start