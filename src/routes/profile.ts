import cors from 'cors'
import { Router } from 'express'

import { getSession } from '@controllers/sessionController.js'

import type { CorsOptions } from 'cors'
import type { Request, Response } from 'express'
import { NightscoutApiFactory } from '@dao/nightscout/api.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}

const router = Router()

// CORS preflight
router.options('/', cors(corsOptions))
router.options('/all', cors(corsOptions))

// GET profile request
router.get('/all', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)

    if (session.verifiedNightscoutUrl === undefined) {
        response.status(407 /* Proxy Authentication Required */).json({message: 'Please verify your Nightscout site first.'})
    } else {
        const nightscout = NightscoutApiFactory.getApi(session.nightscoutApiVersion)
        
        try {
            const profiles = await nightscout.profileStore(new URL(session.verifiedNightscoutUrl!), session.verifiedNightscoutToken)
            response.status(200).json(profiles)
        } catch (error: any) {
            response.status(500).json({ message: error.message})
        }
            
    }
})

export default router