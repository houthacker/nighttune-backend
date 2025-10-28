import type { Request, Response } from 'express'
import type { CorsOptions } from 'cors'

import cors from 'cors'
import { Router } from 'express'
import { type } from 'arktype'

import { SqliteDao } from '../dao/sqlite.js'
import { AutotuneJob } from '../models/job.js'
import { getSession } from '../controllers/sessionController.js'
import { JobController } from '../controllers/jobController.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}
const router = Router()
const controller = new JobController(
    new SqliteDao(process.env.NT_DB_PATH!) 
)

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
            // Check if Nightscout URL from autotune job is the same as the verified URL from the session cookie.
            const verifiedUrl = new URL(session.verifiedNightscoutUrl!).toString()
            const jobUrl = new URL(jobRequest.nightscout_url).toString()

            if (verifiedUrl !== jobUrl) {
                response.status(400).json({message: `The Nightscout URL '${jobUrl}' in the autotune job configuration is unverified.`})
            } else {

                // If all is OK, submit the job request.
                await controller.submit(jobRequest)
                response.status(200)
            }
        } catch (error) {
            console.error('Error while verifying Nightscout URL from autotune job: ', error)
            response.status(400).json({message: 'Error while verifying Nightscout URL from autotune job.'})
        }
    }

    response.end()
})

export default router