import type { Request, Response } from 'express'
import type { CorsOptions } from 'cors'

import cors from 'cors'
import { Router } from 'express'
import { getSession } from '../controllers/sessionController.js'

import { NightscoutDao } from '../dao/nightscout.js'

const dao = new NightscoutDao()
const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}
const router = Router()

router.options('/verify', cors(corsOptions))
router.post('/verify', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)

    // Verify we can access the Nightscout site and store the base url
    // in the cookie. This provides at least some ensurance the user
    // hasn't picked any random Nightscout site and is messing around with it.
    if (await dao.verify(request.body.url, request.body.token)) {
        session.verifiedNightscoutUrl = request.body.url
        session.save()

        response.status(200)
    } else {
        session.verifiedNightscoutUrl = undefined
        session.save()

        response.status(400).json({message: 'Nightscout API verification failed.'})
    }

    response.end()
})

export default router