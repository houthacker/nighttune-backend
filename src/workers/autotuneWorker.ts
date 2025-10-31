import { JobWorkerConfig, WorkerMessage, WorkerMessageReasonCode } from '../models/job.js'
import { NightscoutDao } from '../dao/nightscout.js'

import { parentPort } from 'node:worker_threads'

/**
 * Executes the job using the given configuration.
 * 
 * @param config The job configuration.
 */
export default async (config: JobWorkerConfig) => {
    const nightscout = new NightscoutDao()

    if (await nightscout.verify(config.job.nightscout_url, config.job.nightscout_access_token) !== true) {
        return parentPort?.postMessage({
            jobId: config.id,
            reasonCode: WorkerMessageReasonCode.NightscoutVerificationFailed,
        } as WorkerMessage)
    } else {
        await nightscout.autotune(config)
    }
}