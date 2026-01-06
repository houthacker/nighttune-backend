import sqlite from 'better-sqlite3'
import { strict as assert } from 'node:assert'

import { tz } from '@date-fns/tz'
import { constructNow, fromUnixTime, getUnixTime } from 'date-fns'
import { GDPRUserData } from '../models/gdpr.js'
import logger from '../logger.js'
import { AutotuneErrorType, AutotuneJob as AutotuneJobT, FailedJob, JobId, JobMeta, POST_PROCESSING_REPLACER, POST_PROCESSING_REVIVER } from '../models/job.js'
import { AutotuneOptions, AutotuneResult } from '../services/recommendationsParser.js'

export { SqliteError } from 'better-sqlite3'
export type JobStatus = 'submitted' | 'processing' | 'error'

type AutotuneJob = typeof AutotuneJobT.infer
type JobRow = {id: number, uuid: string, submit_ts: number, done_ts?: number , state: string, parameters: string}

function isDatabase(arg: sqlite.Database): arg is sqlite.Database {
    return typeof arg === 'object' && typeof arg.memory === 'boolean'
}

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
     * @param db The database instance.
     * @throws `TypeError` If `db` is not a database instance.
     */
    constructor(db: sqlite.Database)

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
    constructor(path: string)
    constructor(arg: any) {
        if (typeof arg === 'string') {
            this.db = new sqlite(arg, {
                fileMustExist: true
            })
            this.db.pragma('journal_mode = WAL')
            this.db.pragma('foreign_keys = ON')
        }

        assert(isDatabase(arg), new TypeError('Cannot create SqliteDao: constructor argument must be a path string or an sqlite.Database'))
        
        arg.pragma('journal_mode = WAL')
        arg.pragma('foreign_keys = ON')
        this.db = arg
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

    private get<T>(sql: string, ...parameters: unknown[]): T | undefined {
        return this.db.prepare(sql).get(...parameters) as T | undefined
    }

    private all<T>(sql: string, ...parameters: unknown[]): Array<T> {
        return this.db.prepare(sql).all(...parameters) as Array<T>
    }

    /**
     * Converts a row from the `jobs` table to a JobMeta instance.
     */
    private static jobFromRow(row: JobRow): JobMeta {
        const parameters = JSON.parse(row.parameters) as AutotuneOptions

        return new JobMeta(
            row.uuid, 
            row.state as JobMeta['status'], 
            fromUnixTime(row.submit_ts, {
                in: tz(parameters.timeZone)
            }),
            row.done_ts ? fromUnixTime(row.done_ts, {
                in: tz(parameters.timeZone)
            }) : undefined
        )
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
            'INSERT INTO `jobs` (`uuid`, `ns_url`, `backend_version`, `parameters`) VALUES (@id, @url, @version, @parameters)', 
            {id: uuid, url: url.href, version: process.env.NT_VERSION!, parameters})
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

            if (row) {
                this.begin()
                this.run('UPDATE `jobs` SET `state` = \'error\' WHERE `uuid` = @uuid', { uuid })
                this.run('INSERT INTO `job_errors` (`job_id`, `error_code`) VALUES (@id, @errorCode)', { id: row.id, errorCode: reasonCode })
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

            if (row) {
                this.begin()
                this.run('UPDATE `jobs` SET `state` = \'success\', `done_ts` = @doneTs WHERE `uuid` = @uuid', 
                    { doneTs: getUnixTime(constructNow(tz('UTC'))), uuid })
                this.run('INSERT INTO `job_results` (`job_id`, `recommendations`) VALUES(@id, @recommendations)', 
                    { id: row.id, recommendations: JSON.stringify(recommendations, POST_PROCESSING_REPLACER) })
                this.commit()
                return true
            }
        } catch (error) {
            logger.error(`Cannot store job results:\n${JSON.stringify(error)}`)
            this.rollback()
        }

        return false
    }

    result(url: URL, uuid: JobId): AutotuneResult | undefined {
        const row = this.get<{recommendations: string}>(
            'SELECT `r`.`recommendations` \
             FROM `job_results` as `r` \
             JOIN `jobs` ON `jobs`.`id` = `r`.`job_id`\
             WHERE `jobs`.`uuid` = @uuid\
             AND `jobs`.`ns_url` = @url', { url: url.href, uuid })

        return row === undefined ? undefined : JSON.parse(row.recommendations, POST_PROCESSING_REVIVER) as AutotuneResult
    }

    /**
     * Retrieves the latest `limit` jobs that have been submitted for `url`.
     * 
     * @param url The Nightscout site URL.
     * @param limit The maximum amount of jobs to retrieve.
     * @returns The requested jobs, or an empty array if no jobs exist for `url`.
     */
    jobs(url: URL, limit: number): Array<JobMeta> {
        const all = this.all<JobRow>(
            'SELECT `id`, `uuid`, `submit_ts`, `state`, `parameters` \
             FROM `jobs` \
             WHERE `ns_url` = @url \
             ORDER BY `submit_ts` DESC \
             LIMIT @limit;',
            { url: url.href, limit }
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
        const row = this.get<JobRow>(
            'SELECT `id`, `uuid`, `state`, `submit_ts`, `parameters` \
             FROM `jobs` \
             WHERE `ns_url` = @url \
             ORDER BY `submit_ts` DESC \
             LIMIT 1;', 
            { url: url.href })

        if (row !== undefined) {
            return SqliteDao.jobFromRow(row)
        }

        return undefined
    }

    userData(url: URL): GDPRUserData {
        type AutotuneResultRow = {id: number, uuid: string, recommendations: string}
        type FailedJobRow = {id: number, uuid: string, error_code: AutotuneErrorType}

        this.begin()

        try {
            const jobs = this.all<JobRow>(
                'SELECT `uuid`, `submit_ts`, `done_ts`, `state`, `parameters` FROM `jobs` WHERE `ns_url` = @url;',
                { url: url.href }
            ).map(SqliteDao.jobFromRow)
            const job_results = this.all<AutotuneResultRow>(
                'SELECT `r`.`job_id`, `r`.`recommendations` FROM `job_results` AS `r` INNER JOIN `jobs` AS `j` ON `j`.`id` = `r`.`job_id` WHERE `j`.`ns_url` = @url;',
                { url: url.href }
            ).map((row) => {
                return new AutotuneResult(JSON.parse(row.recommendations, POST_PROCESSING_REVIVER), undefined)
            })
            const failed_jobs = this.all<FailedJobRow>(
                'SELECT `e`.`job_id`, `j`.`uuid`, `e`.`error_code` FROM `job_errors` AS `e` INNER JOIN `jobs` AS `j` ON `j`.`id` = `e`.`job_id` WHERE `j`.`ns_url` = @url;',
                { url: url.href }
            ).map((row) => {
                return new FailedJob(row.uuid, row.error_code)
            })

            return new GDPRUserData(jobs, job_results, failed_jobs)

        } finally {
            this.commit()
        }
    }
}