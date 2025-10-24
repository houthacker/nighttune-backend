import type { Request, Response } from 'express'
import type { CorsOptions } from 'cors'

import cors from 'cors'
import { Router } from 'express'
import { type } from 'arktype'

import { AutotuneJob } from '../models/job.js'
import { getSession } from '../controllers/sessionController.js'
import { JobMqttDAO } from '../dao/job.js'
import { JobController } from '../controllers/jobController.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}
const router = Router()
const mqttDao = new JobMqttDAO(process.env.NT_MQTT_URL!, process.env.NT_MQTT_USER!, process.env.NT_MQTT_PASSWORD!, process.env.NT_MQTT_SUBMIT_TOPIC!)
const controller = new JobController(mqttDao)

// Handle CORS preflight
router.options('/', cors(corsOptions))

// Turnstile verification
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)

    if (session.turnstileTestPassed === true) {
        const jobRequest = AutotuneJob(request.body)

        if (jobRequest instanceof type.errors) {
            response.status(400).json({ message: jobRequest.summary })
        } else {
            await controller.submit(jobRequest)
            response.status(200)
        }
    } else {
        console.error('Client has not (yet) passed turnstile test.')
        response.status(400).json({ message: 'Please verify turnstile test first.'})
    }

    response.end()
})

export default router