import { type } from 'arktype'
import cors from 'cors'
import { Router } from 'express'

import { getSession } from '../controllers/sessionController.js'
import { NightscoutDao } from '../dao/nightscout.js'
import { NightscoutApiFactory } from '../dao/nightscout/api.js'
import { VerificationRequest } from '../models/verify.js'

import type { CorsOptions } from 'cors'
import type { Request, Response } from 'express'
import { NightscoutApiVersion } from '../models/nightscout.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}

const router = Router()

// CORS preflight
router.options('/', cors(corsOptions))

// POST verification request
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const verification = VerificationRequest(request.body)
    if (verification instanceof type.errors) {
        response.status(400).json({ message: verification.summary })
    } else {
        const nightscout = new NightscoutDao(
            NightscoutApiFactory.getApi(verification.nightscout_api_version)
        )

        // Calling VerificationRequest() also validates if body.nightscout_url is a valid url.
        const url = new URL(verification.nightscout_url)
        const session = await getSession(request, response)

        if (await nightscout.verify(url, verification.nightscout_access_token)) {
            session.verifiedNightscoutUrl = url.href
            session.verifiedNightscoutToken = verification.nightscout_access_token
            session.nightscoutApiVersion = verification.nightscout_api_version
            response.status(200)
        } else {
            session.verifiedNightscoutUrl = undefined
            session.verifiedNightscoutToken = undefined
            session.nightscoutApiVersion = NightscoutApiVersion.v1
            response.status(407 /* Proxy Authentication Required */)
        }
        
        await session.save()
        response.end()
    }
})

export default router