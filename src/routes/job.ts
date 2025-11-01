import type { Request, Response } from 'express'
import type { CorsOptions } from 'cors'

import cors from 'cors'
import { Router } from 'express'
import { type } from 'arktype'
import { inspect } from 'node:util'

import { AutotuneJob, JobAlreadyEnqueuedError, GenericDatabaseError, JobExecutionError } from '../models/job.js'
import { getSession } from '../controllers/sessionController.js'
import { JobController } from '../controllers/jobController.js'
import { SqliteDao } from '../dao/sqlite.js'
import { NightscoutDao } from '../dao/nightscout.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}
const router = Router()
const controller = new JobController(new SqliteDao(process.env.NT_DB_PATH!), new NightscoutDao())

// Handle CORS preflight
router.options('/', cors(corsOptions))

//
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)

    if (session.turnstileTestPassed !== true) {
        console.error('Client has not (yet) passed turnstile test.')
        response.sendStatus(400).json({ message: 'Please verify turnstile test first.'})
        return
    }

    const jobRequest = AutotuneJob(request.body)
    if (jobRequest instanceof type.errors) {
        response.status(400).json({ message: jobRequest.summary })
    } else {

        try {
            const jobId = await controller.submit(jobRequest)
            response.status(200).json({ jobId })
        } catch (error: any) {
            if (error instanceof JobAlreadyEnqueuedError) {
                console.error(`[job ${error.jobId}]: ${inspect(error)}`)
                response.status(400).json({jobId: error.jobId, message: 'Job already enqueued.'})
            } else if (error instanceof GenericDatabaseError || error instanceof JobExecutionError) {
                console.error(`[job ${error.jobId}]: ${inspect(error)}`)
                response.status(500).json({ jobId: error.jobId })
            } else {
                console.error(`[job <unknown>]: ${inspect(error)}`)
                response.status(500).json({message: 'Generic error running job with unknown id.'})
            }
        }
    }

    response.end()
})

export default router