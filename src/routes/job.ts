import type { NextFunction, Request, Response } from 'express'
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

// All requests must have the session cookie, have passed the turnstile- and Nightscout access test.
router.use(async (request: Request, response: Response, next: NextFunction) => {
    const session = await getSession(request, response)

    if (session.turnstileTestPassed !== true) {
        console.error('Client has not (yet) passed turnstile test.')
        response.sendStatus(403).json({ message: 'Please verify turnstile test first.'})
        return next('route')
    } else {
        try {
            new URL(session.verifiedNightscoutUrl || '')
        } catch (error) {
            console.error('`Nightscout URL not verified.')
            response.sendStatus(403).json({ message: 'Please verify the Nightscout URL and token first.'})
        }
    }
})

// Handle CORS preflight
router.options('/', cors(corsOptions))

// POST a new job request
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
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

// GET the status of all current and previous jobs.
router.get('/all', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)

    try {
        const jobs = await controller.all(new URL(session.verifiedNightscoutUrl!))
        response.status(200).json({ jobs })
    } catch (error: any) {
        console.error(`Error retrieving jobs: ${inspect(error)}`)
        response.status(500).json({ message: 'Error retrieving jobs' })
    }

    response.end()
})

// GET the status of any queued job for the given Nightscout URL
router.get('/poll', cors(corsOptions), async(request: Request, response: Response) => {
    const session = await getSession(request, response)

    try {
        const job = await controller.poll(new URL(session.verifiedNightscoutUrl!))
        response.status(200).json({ job })
    } catch (error: any) {
        console.error(`[job ${request.body.id}] Error while polling: ${inspect(error)}`)
        response.status(500).json({ message: 'Error polling job'})
    }

    response.end()
})

export default router