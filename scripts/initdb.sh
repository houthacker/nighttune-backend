#!/usr/bin/env bash

# Exit immediately on error
set -e

ME="${0}"
MY_DIR=$(dirname $(readlink -f ${ME}))

show_usage() {
    cat <<EOF
NAME
${ME} - Initialize a nighttune-backend sqlite3 database.

SYNOPSIS
${ME} <db_schema.sql> <db_file>

DESCRIPTION
Initialize an sqlite3 database with the statement in the database schema 
file. 
This requires that you have sourced the appropriate .env file as well.

OPTIONS
db_schema.sql   - The path to the sql file containing the database schema.

db_file         - The path to the database file.

NOTE
If the database already exists, re-initializing the database only executes 
changes that have not yet been applied to the database. It doesn't touch 
any data.
EOF
}


schema_file=${1:-$(realpath ${MY_DIR}"/../src/config/db.sql")}
db_file=${2:-$(realpath ${MY_DIR}"/../nighttune-backend-test.db")}

if [ ! -f "${schema_file}" ]; then
    echo "Database schema ${schema_file} does not exist." >&2
    show_usage
    exit 1
else
    echo "Using database schema from ${schema_file}"
fi

if [ ! -f $(which sqlite3) ]; then
    echo "Could not locate sqlite3, please install it first." >&2
fi

echo "Creating nighttune database at ${db_file}"
sqlite3 ${db_file} < ${schema_file}
echo "Database initialization successful"