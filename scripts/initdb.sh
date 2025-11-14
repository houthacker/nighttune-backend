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
${ME} <db_file> <db_schema.sql>

DESCRIPTION
Initialize an sqlite3 database with the statements from the database schema 
file. 

OPTIONS
db_file         - The path to the database file.

db_schema.sql   - The path to the sql file containing the database schema.

NOTE
If the database already exists, re-initializing the database only executes 
changes that have not yet been applied to the database. It doesn't touch 
any data.
EOF
}

db_file=${1:-$(realpath ${MY_DIR}"/../nighttune-backend-test.db")}
schema_file=${2:-$(realpath ${MY_DIR}"/../src/config/db.sql")}

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