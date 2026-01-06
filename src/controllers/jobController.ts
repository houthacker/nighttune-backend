import { readFile} from 'node:fs/promises'
import { v4 as uuidv4 } from 'uuid'
import { MailDao } from '../dao/mail.js'
import { NightscoutDao } from '../dao/nightscout.js'
import { SqliteDao, SqliteError } from '../dao/sqlite.js'
import logger from '../logger.js'

import {
    AutotuneConfig,
    AutotuneJob as AutotuneJobT,
    GenericDatabaseError,
    JobAlreadyEnqueuedError,
    JobExecutionError,
    JobId,
    JobMeta,
} from '../models/job.js'
import { AutotuneOptions, AutotuneResult } from '../services/recommendationsParser.js'

import type { AutotuneError } from '../dao/nightscout.js'

type AutotuneJob = typeof AutotuneJobT.infer

const SQLITE_ERROR: string = 'SQLITE_ERROR'
const SQLITE_CONSTRAINT: string = 'SQLITE_CONSTRAINT'
const SQLITE_CONSTRAINT_TRIGGER: string = 'SQLITE_CONSTRAINT_TRIGGER'
const SQLITE_CONSTRAINT_UNIQUE: string = 'SQLITE_CONSTRAINT_UNIQUE'

const createAutotuneCallback = (sqlite: SqliteDao, mail: MailDao) => {
    return async (error: AutotuneError| null, recommendations?: AutotuneResult): Promise<void> => {
        if (error) {
            sqlite.onJobFailed(error.data.jobId, error.data.type)
            logger.warn(`[job ${error.data.jobId}] failed: \n${JSON.stringify(error)}`)

            try {
                const logFileContents = await readFile(error.autotuneLogFile, { encoding: 'utf8'})
                logger.warn(`[job ${error.data.jobId}] Autotune log file contents:\n${logFileContents}`)
            } catch(_: any) {
                logger.warn(`[job ${error.data.jobId}] could not read autotune log.`)
            }
        } else {
            const report = recommendations!
            const opts = report.options as AutotuneOptions
            sqlite.onJobSuccessful(opts.jobId, report)
            
            if (report.options?.emailAddress) {
                await mail.sendReport(report.options.emailAddress!, report)
            }
        }
    }
}

export class JobController {

    private readonly sqlite: SqliteDao

    private readonly nightscout: NightscoutDao

    private readonly mail: MailDao

    constructor(sqlite: SqliteDao, nightscout: NightscoutDao, mail: MailDao) {
        this.sqlite = sqlite
        this.nightscout = nightscout
        this.mail = mail
    }

    /**
     * Submit a job to the work queue.
     * 
     * @throws `JobError` if running the job fails.
     */
    async submit(job: AutotuneJob): Promise<JobId> {
        const id: JobId = uuidv4()

        // Enqueue the job here and not in the worker, because this allows
        // us to let the client know fast if the job was enqueued successfully.
        // Otherwise we'd have to poll the database for that.
        try {

            // Remove the access token from the job information.
            // We only need it at runtime so it must not be stored.
            const { nightscout_access_token, ...jobWithoutToken } = job
            this.sqlite.submit(id, new URL(job.nightscout_url), jobWithoutToken)
            await this.nightscout.autotune({ id, job } as AutotuneConfig, createAutotuneCallback(this.sqlite, this.mail))
            return id
        } catch (error) {
            if (error instanceof SqliteError) {
                switch (error.code) {
                    // Returned on trigger failure.
                    case SQLITE_CONSTRAINT:

                    // Returned on regular unique constraint violation
                    case SQLITE_CONSTRAINT_TRIGGER:
                    case SQLITE_CONSTRAINT_UNIQUE:
                        throw new JobAlreadyEnqueuedError(id, 'Job already queued', error)

                    case SQLITE_ERROR:
                    default:
                        throw new GenericDatabaseError(id, 'Database error', error)
                }
            } else {
                throw new JobExecutionError(id, 'Error while executing job', error)
            }
        }
    }

    /**
     * Return the result of the given job.
     * 
     * @param url The Nightscout URL against which the job ran.
     * @param id The job id.
     * @returns The result, or `undefined` if no such result exists.
     */
    async result(url: URL, id: JobId): Promise<AutotuneResult | undefined> {
        return this.sqlite.result(url, id)
    }

    /**
     * Return the last `limit` jobs.
     * 
     * @param url The Nightscout URL to retrieve the statuses of.
     * @param limit The maximum amount of statuses to retrieve. Defaults to `30`.
     * @returns An array of `JobMeta` instances for the given URL.
     */
    async all(url: URL, limit: number = 30): Promise<Array<JobMeta>> {
        return this.sqlite.jobs(url, limit)
    }

    /**
     * Poll the state of the last queued job.
     * 
     * @returns The job data, or `undefined` if there is no such job.
     */
    async latest(url: URL): Promise<JobMeta | undefined> {
        return this.sqlite.latest(url)
    }
}