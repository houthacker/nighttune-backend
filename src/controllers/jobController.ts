import { v4 as uuidv4 } from 'uuid'
import { NightscoutDao } from '../dao/nightscout.js'
import { SqliteDao, SqliteError } from '../dao/sqlite.js'
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

const SQLITE_CONSTRAINT: string = 'SQLITE_CONSTRAINT'
const SQLITE_CONSTRAINT_UNIQUE: string = 'SQLITE_CONSTRAINT_UNIQUE'

const createAutotuneCallback = (sqlite: SqliteDao) => {
    return (error: AutotuneError | null, recommendations?: AutotuneResult): void => {
        if (error) {
            sqlite.jobFailed(error.jobId, error.type)
            console.error(`[job ${error.jobId}] error: ${error.log}`)
        } else {
            const opts = recommendations!.options as AutotuneOptions
            sqlite.jobSuccessful(opts.jobId, recommendations!)
            console.log(`[job ${opts.jobId}] success.`)
        }
    }
}

export class JobController {

    private readonly sqlite: SqliteDao

    private readonly nightscout: NightscoutDao

    constructor(sqlite: SqliteDao, nightscout: NightscoutDao) {
        this.sqlite = sqlite
        this.nightscout = nightscout
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
            this.sqlite.enqueueJob(id, job.nightscout_url, job)
            await this.nightscout.autotune({ id, job } as AutotuneConfig, createAutotuneCallback(this.sqlite))
        } catch (error) {
            if (error instanceof SqliteError) {
                switch (error.code) {
                    // Returned on trigger failure.
                    case SQLITE_CONSTRAINT:

                    // Returned on regular unique constraint violation
                    case SQLITE_CONSTRAINT_UNIQUE:
                        throw new JobAlreadyEnqueuedError(id, 'Job already queued', error)
                    default:
                        throw new GenericDatabaseError(id, 'Database error', error)
                }
            } else {
                throw new JobExecutionError(id, 'Error while executing job', error)
            }
        } finally {
            return id
        }
    }

    /**
     * Return the last `limit` jobs.
     * 
     * @param url The nightscout url to retrieve the statuses of.
     * @param limit The maximum amount of statuses to retrieve. Defaults to `30`.
     * @returns An array of `JobMeta` instances for the given URL.
     */
    async all(url: URL, limit: number = 30): Promise<Array<JobMeta>> {
        return this.sqlite.jobs(url, limit)
    }

    /**
     * Poll the state of the last queued job.
     */
    async poll(url: URL): Promise<JobMeta | undefined> {
        return this.sqlite.poll(url)
    }
}