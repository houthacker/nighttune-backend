import { type } from 'arktype'
import cors from 'cors'
import { Router } from 'express'

import { getSession } from '@controllers/sessionController.js'

import type { CorsOptions } from 'cors'
import type { Request, Response } from 'express'
import { NightscoutDao } from '@dao/nightscout.js'
import { NightscoutApiFactory } from '@dao/nightscout/api.js'
import { RetainedDataRequest } from '@/models/entries.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}

const router = Router()

// CORS preflight
router.options('/', cors(corsOptions))
router.options('/have-retained-data', cors(corsOptions))

// POST validate available days of data in NS instance.
router.post('/have-retained-data', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)

    if (session.verifiedNightscoutUrl === undefined) {
        response.status(407 /* Proxy Authentication Required */).json({message: 'Please verify your Nightscout site first.'})
        return
    }

    const validatedRequest = RetainedDataRequest(request.body)
    if (validatedRequest instanceof type.errors) {
        response.status(400).json({ message: validatedRequest.summary })
    } else {
        const nightscout = new NightscoutDao(
            NightscoutApiFactory.getApi(session.nightscoutApiVersion)
        )
    
        const haveRetainedData = await nightscout.haveRetainedData(
            new URL(session.verifiedNightscoutUrl), 
            validatedRequest.days, 
            validatedRequest.timezone, 
            session.verifiedNightscoutToken
        )

        response.status(haveRetainedData ? 200 : 404)
    }

})

export default router