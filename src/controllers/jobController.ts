import { v4 as uuidv4 } from 'uuid'
import { 
    AutotuneJob as AutotuneJobT, 
    JobWorkerConfig,  
    JobId, 
    JobAlreadyEnqueuedError, 
    GenericDatabaseError, 
    JobExecutionError, 
    WorkerMessage,
    WorkerMessageReasonCode,
 } from '../models/job.js'
import { SqliteDao, SqliteError } from '../dao/sqlite.js'

import { Piscina } from 'piscina'
import { inspect } from 'node:util'

type AutotuneJob = typeof AutotuneJobT.infer

const SQLITE_CONSTRAINT: string = 'SQLITE_CONSTRAINT'
const SQLITE_CONSTRAINT_UNIQUE: string = 'SQLITE_CONSTRAINT_UNIQUE'

const pool = new Piscina({
    filename: new URL('../workers/jobWorker.js', import.meta.url).href,
    maxQueue: 'auto'
})

export class JobController {

    private readonly sqlite: SqliteDao

    constructor(sqlite: SqliteDao) {
        this.sqlite = sqlite

        pool.on('message', this.dispatch)
    }

    /**
     * Dispatch messages from worker threads.
     */
    private dispatch(message: WorkerMessage) {
        switch (message.reasonCode) {
            case WorkerMessageReasonCode.NightscoutVerificationFailed:
                this.sqlite.jobFailed(message.jobId, message.reasonCode)
            default:
                console.error(`Unsupported worker message: ${inspect(message)}`)
        }
    }

    /**
     * Submit a job to the work queue.
     * 
     * @throws `JobError` if running the job fails.
     */
    async submit(job: AutotuneJob): Promise<void> {
        const id: JobId = uuidv4()

        // Enqueue the job here and not in the worker, because this allows
        // us to let the client know fast if the job was enqueued successfully.
        // Otherwise we'd have to poll the database for that.
        try {
            this.sqlite.enqueueJob(id, job.nightscout_url, job)
            await pool.run({ id, job } as JobWorkerConfig)
        } catch (error) {
            if (error instanceof SqliteError) {
                switch (error.code) {
                    // Returned on trigger failure.
                    case SQLITE_CONSTRAINT:

                    // Returned on regar unique constraint violation
                    case SQLITE_CONSTRAINT_UNIQUE:
                        throw new JobAlreadyEnqueuedError(id, 'Job already queued', error)
                    default:
                        throw new GenericDatabaseError(id, 'Database error', error)
                }
            } else {
                throw new JobExecutionError(id, 'Error while executing job', error)
            }
        }
    }
}