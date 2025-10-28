import sqlite from 'better-sqlite3'

export class SqliteDao {

    /**
     * The sqlite database
     */
    private readonly db: sqlite.Database

    /**
     * Create a new `SqliteDao`, opening the database at `path`. The database must have been
     * initialized before calling this. The initialization can be done using the `src/config/db.sql` file,
     * and will run only those updates and migrations that haven't been executed yet.
     * 
     * ```bash
     * $ cat src/config/db.sql | sqlite3 database.db
     * ```
     * 
     * @param path The path to the database.
     * @throws `Error` If the database file does not exist.
     */
    constructor(path: string) {
        this.db = new sqlite(path, {
            fileMustExist: true
        })
        this.db.pragma('journal_mode = WAL')
    }

    /**
     * Starts a new, unnestable transaction.
     * 
     * @throws `Error` if execution of the BEGIN statement fails.
     */
    private begin() {
        this.db.prepare('BEGIN DEFERRED').run()
    }

    /**
     * Commits the current unnestable transaction.
     * If an `Error` of type `SqliteError` is thrown and its `code === 'SQLITE_BUSY'`, there
     * was an open read operation when trying to commit and the commit can juts be
     * retried until it succeeds.
     * 
     * @throws `Error` If executing the COMMIT statement fails.
     */
    private commit() {
        this.db.prepare('COMMIT').run()
    }

    /**
     * Rollback the current transaction.
     * 
     * @throws `Error` if executing the ROLLBACK statement fails.
     */
    private rollback() {
        this.db.prepare('ROLLBACK').run()
    }

    /**
     * Prepares the given query and executes it without enclosing it in a transaction.
     * 
     * @param sql The sql statement to execute.
     * @param parameters The parameters of the statement.
     * @returns The result.
     * 
     * @throws `Error` if query execution fails.
     */
    private execute(sql: string, ...parameters: unknown[]): sqlite.RunResult {
        return this.db.prepare(sql).run(parameters)
    }

    /**
     * Executes the given statement within a transcation. The transaction is rolled back
     * if an error occurs and otherwise committed.
     * 
     * @param sql The sql statement to execute.
     * @param parameters The parameters of the statement.
     * 
     * @throws `Error` if executing the statement fails.
     */
    private executeInTransaction(sql: string, ...parameters: unknown[]): sqlite.RunResult {
        const fn = this.db.transaction((): sqlite.RunResult => {
            return this.db.prepare(sql).run(parameters)
        })

        return fn()
    }

    /**
     * Notifies the database a new job is going to be enqueued. 
     * 
     * Also, this enables showing the amount of queued jobs to users.
     * @param id The unique identifier of the job.
     * @param url The Nightscout URL
     * @param settings The settings object.
     */
    enqueueJob(id: string, url: string, settings: object) {
        this.executeInTransaction('INSERT INTO `job_queue` (`job_uuid`, `ns_url`, `parameters`) VALUES (@id, @url, @settings)', {id, url, settings})
    }
}