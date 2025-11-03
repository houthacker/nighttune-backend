import cors from 'cors'
import { Router } from 'express'
import { type } from 'arktype'

import { NightscoutDao } from '../dao/nightscout.js'
import { VerificationRequest } from '../models/verify.js'
import { getSession } from '../controllers/sessionController.js'

import type { Request, Response } from 'express'
import type { CorsOptions } from 'cors'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}

const nightscout = new NightscoutDao()
const router = Router()

// CORS preflight
router.options('/', cors(corsOptions))

// POST verification request
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const verification = VerificationRequest(request.body)
    if (verification instanceof type.errors) {
        response.status(400).json({ message: verification.summary })
    } else {
        // Calling VerificationRequest() also validates if body.nightscout_url is a valid url.
        const url = new URL(verification.nightscout_url)
        const session = await getSession(request, response)
        session.verifiedNightscoutUrl = await nightscout.verify(url, verification.nightscout_access_token)
            ? url.href
            : undefined

        session.save()
    }

    response.end()
})

export default router