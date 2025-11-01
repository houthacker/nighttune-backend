import sqlite from 'better-sqlite3'
import { JobId } from '../models/job.js'
import { AutotuneResult } from '../services/recommendationsParser.js'

export { SqliteError } from 'better-sqlite3'
export type JobStatus = 'submitted' | 'processing' | 'error'

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
    private begin(): SqliteDao {
        this.db.prepare('BEGIN DEFERRED').run()
        return this
    }

    /**
     * Commits the current unnestable transaction.
     * If an `Error` of type `SqliteError` is thrown and its `code === 'SQLITE_BUSY'`, there
     * was an open read operation when trying to commit and the commit can juts be
     * retried until it succeeds.
     * 
     * @throws `Error` If executing the COMMIT statement fails.
     */
    private commit(): SqliteDao {
        this.db.prepare('COMMIT').run()
        return this
    }

    /**
     * Rollback the current transaction.
     * 
     * @throws `Error` if executing the ROLLBACK statement fails.
     */
    private rollback(): SqliteDao {
        this.db.prepare('ROLLBACK').run()
        return this
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
    private run(sql: string, ...parameters: unknown[]): sqlite.RunResult {
        return this.db.prepare(sql).run(...parameters)
    }

    private get<T>(sql: string, ...parameters: unknown[]): T {
        return this.db.prepare(sql).get(...parameters) as T
    }

    /**
     * Executes the given statement within a transcation. The transaction is rolled back
     * if an error occurs and otherwise committed.
     * 
     * @param sql The sql statement to execute.
     * @param parameters The parameters of the statement.
     * @returns The amount of rows changed and the last inserted rowid, if any. 
     * @throws If executing the statement fails.
     */
    private executeInTransaction(sql: string, ...parameters: unknown[]): sqlite.RunResult {
        const fn = this.db.transaction((): sqlite.RunResult => {
            return this.db.prepare(sql).run(...parameters)
        })

        return fn()
    }

    /**
     * Submit a new job to the queue. 
     * 
     * Inserting a job can lead to a job conflict, which causes this method to fail. Enqueueing a job 
     * conflicts when a previous job with the same status exists. Jobs with status `error` do not
     * cause conflicts.
     * 
     * @param id The unique identifier of the job.
     * @param url The normalized Nightscout URL
     * @param settings The settings object.
     * @returns The amount of rows changed and the last inserted rowid, if any.
     * @throws `Error` if a job exists for the given `ns_url` that has a `JobStatus` of `submitted` or `processing`.
     */
    enqueueJob(id: string, url: string, settings: object): sqlite.RunResult {
        const json_settings = JSON.stringify(settings)
        return this.executeInTransaction(
            'INSERT INTO `job_queue` (`job_uuid`, `ns_url`, `parameters`) VALUES (@id, @url, @json_settings)', 
            {id, url, json_settings})
    }

    /**
     * Record job failure and store the reason for later retrieval.
     * 
     * @param jobId The unique job identifier.
     * @param reasonCode The coded failure reason.
     * @returns `true` if the job failure was recorded in the database, `false` otherwise.
     */
    jobFailed(jobId: JobId, reasonCode: string): boolean {
        try {
            this.begin()
            this.run('UPDATE `job_queue` SET `state` = \'error\' WHERE `job_uuid` = @jobId', { jobId })
            this.run('INSERT INTO `job_errors` (`job_uuid`, `reason_code`) VALUES (@jobId, @errorCode)', { jobId, errorCode: reasonCode })
            this.commit()
            return true
        } catch (error) {
            this.rollback()
        }

        return false
    }

    jobSuccessful(jobId: JobId, recommendations: AutotuneResult): boolean {
        try {
            const { options, ...resultWithoutOptions } = recommendations
            const queued_job = this.get<{ create_ts: number }>('SELECT `create_ts` FROM `job_queue` WHERE `job_uuid` = @jobId', { jobId })

            this.begin()
            this.run('INSERT INTO `recommendations` (`job_uuid`, `ns_url`, `create_ts`, `parameters`, `recommendation`) \
                VALUES (@jobId, @nsUrl, @createTs, @parameters, @recommendations)', {
                    jobId, 
                    nsUrl: recommendations.options.nsHost, 
                    createTs: queued_job.create_ts, 
                    parameters: JSON.stringify(recommendations.options),
                    recommendations: JSON.stringify(resultWithoutOptions)
                })
            this.run('DELETE FROM `job_queue` WHERE `job_uuid` = @jobId', { jobId })
            this.commit()
            return true
        } catch (error) {
            this.rollback()
        }

        return false
    }
}