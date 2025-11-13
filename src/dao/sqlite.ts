import sqlite from 'better-sqlite3'
import { JobId, JobMeta, AutotuneJob as AutotuneJobT } from '../models/job.js'
import { AutotuneOptions, AutotuneResult } from '../services/recommendationsParser.js'
import { constructNow, fromUnixTime, getUnixTime } from 'date-fns'
import { tz } from '@date-fns/tz'
import { inspect } from 'node:util'

export { SqliteError } from 'better-sqlite3'
export type JobStatus = 'submitted' | 'processing' | 'error'

type AutotuneJob = typeof AutotuneJobT.infer

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
        this.db.pragma('foreign_keys = ON')
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

    private get<T>(sql: string, ...parameters: unknown[]): T  {
        return this.db.prepare(sql).get(...parameters) as T
    }

    private all<T>(sql: string, ...parameters: unknown[]): Array<T> {
        return this.db.prepare(sql).all(...parameters) as Array<T>
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
     * Submit a new job. 
     * 
     * Only a single job per `ns_url` can be processing at any time. This method fails
     * if multiple jobs for the same `ns_url` are submitted.
     * 
     * @param uuid The unique identifier of the job.
     * @param url The Nightscout site URL
     * @param settings The settings object.
     * @returns The amount of rows changed and the last inserted rowid, if any.
     * @throws If a job exists for the given `ns_url` that has a `JobStatus` of `submitted` or `processing`.
     */
    submit(uuid: JobId, url: URL, settings: AutotuneJob): sqlite.RunResult {
        const parameters = JSON.stringify(settings)
        return this.executeInTransaction(
            'INSERT INTO `jobs` (`uuid`, `ns_url`, `parameters`) VALUES (@id, @url, @parameters)', 
            {id: uuid, url: url.href, parameters})
    }

    /**
     * Record job failure and store the reason for later retrieval.
     * 
     * @param uuid The unique job identifier.
     * @param reasonCode The coded failure reason.
     * @returns `true` if the job failure was recorded in the database, `false` otherwise.
     */
    onJobFailed(uuid: JobId, reasonCode: string): boolean {
        try {
            const row = this.get<{ id: number }>('SELECT `id` FROM `jobs` WHERE `uuid` = @uuid', { uuid })

            if (row !== undefined) {
                this.begin()
                this.run('UPDATE `jobs` SET `state` = \'error\' WHERE `uuid` = @uuid', { uuid })
                this.run('INSERT INTO `job_errors` (`job_id`, `reason_code`) VALUES (@id, @errorCode)', { id: row.id, errorCode: reasonCode })
                this.commit()
                return true
            }
        } catch (error) {
            this.rollback()
        }

        return false
    }

    /**
     * Store the autotune recommendations and set job state on successful job completion.
     * 
     * @param uuid The jobs' unique identifier.
     * @param recommendations The autotune recommendations.
     * @returns `true` if storing the results was successful, `false` otherwise.
     */
    onJobSuccessful(uuid: JobId, recommendations: AutotuneResult): boolean {
        try {
            const row = this.get<{ id: number }>('SELECT `id` FROM `jobs` WHERE `uuid` = @uuid', { uuid })

            if (row !== undefined) {
                this.begin()
                this.run('UPDATE `jobs` SET `state` = \'success\', `done_ts` = @doneTs WHERE `uuid` = @uuid', 
                    { doneTs: getUnixTime(constructNow(tz('UTC'))), uuid })
                this.run('INSERT INTO `job_results` (`job_id`, `recommendations`) VALUES(@id, @recommendations)', 
                    { id: row.id, recommendations: JSON.stringify(recommendations) })
                this.commit()
                return true
            }
        } catch (error) {
            console.error(inspect(error))
            this.rollback()
        }

        return false
    }

    result(url: URL, uuid: JobId): AutotuneResult | undefined {
        const row = this.get<{ recommendations: string | undefined}>(
            'SELECT `r`.`recommendations` \
             FROM `job_results` as `r` \
             JOIN `jobs` ON `jobs`.`id` = `r`.`job_id`\
             WHERE `jobs`.`uuid` = @uuid\
             AND `jobs`.`ns_url` = @url', { url: url.href, uuid })

        return row.recommendations === undefined ? undefined : JSON.parse(row.recommendations)
    }

    /**
     * Retrieves the latest `limit` jobs that have been submitted for `url`.
     * 
     * @param url The Nightscout site URL.
     * @param limit The maximum amount of jobs to retrieve.
     * @returns The requested jobs, or an empty array if no jobs exist for `url`.
     */
    jobs(url: URL, limit: number): Array<JobMeta> {
        const all = this.all<{uuid: string, submit_ts: number, state: string, parameters: string}>(
            'SELECT `uuid`, `submit_ts`, `state`, `parameters` \
             FROM `jobs` \
             WHERE `ns_url` = @url \
             ORDER BY `submit_ts` DESC \
             LIMIT @limit;',
            { url: url.toString(), limit }
        )

        return all.map((row) => {
            const parameters = JSON.parse(row.parameters) as AutotuneOptions

            return new JobMeta(
                row.uuid, 
                row.state as JobMeta['status'], 
                fromUnixTime(row.submit_ts, {
                    in: tz(parameters.timeZone)
                }))
        })
    }

    /**
     * Retrieves the job that was last submitted for `url`. 
     * 
     * @param url The Nightscout site URL.
     * @returns The job, or `undefined` if there is no such job.
     */
    latest(url: URL): JobMeta | undefined {
        const row = this.get<{ uuid: string, state: string, submit_ts: number, parameters: string}>(
            'SELECT `uuid`, `state`, `submit_ts`, `parameters` \
             FROM `jobs` \
             WHERE `ns_url` = @url \
             ORDER BY `submit_ts` DESC \
             LIMIT 1;', 
            { url: url.href })

        if (row !== undefined) {
            const parameters = JSON.parse(row.parameters) as AutotuneOptions
            return new JobMeta(
                row.uuid, 
                row.state as JobMeta['status'],
                fromUnixTime(row.submit_ts, {
                    in: tz(parameters.timeZone)
                })
            )
        }

        return undefined
    }
}