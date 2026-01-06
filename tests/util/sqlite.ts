import sqlite from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

import { SqliteDao } from '../../src/dao/sqlite.js'

export function createInMemoryDatabase(resource: string): SqliteDao {
    const path = fileURLToPath(import.meta.resolve(`${import.meta.dirname}/../resources/${resource}`))
    const sql = readFileSync(path, 'utf8')

    const db = new sqlite(':memory:')
    db.exec(sql)

    return new SqliteDao(db)
}