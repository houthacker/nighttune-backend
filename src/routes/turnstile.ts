import type { CorsOptions } from 'cors'
import type { Request, Response } from 'express'

import cors from 'cors'
import { Router } from 'express'

import { getSession } from '../controllers/sessionController.js'
import { validateTurnstile } from '../controllers/turnstileController.js'
import logger from '../logger.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}
const router = Router()

// Handle CORS preflight
router.options('/', cors(corsOptions))

// Turnstile verification
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const ip = request.get('CF-Connecting-IP') || request.ip!
    const validation = await validateTurnstile(request.body.token, ip)

    if (validation.success) {
        const session = await getSession(request, response)
        session.turnstileTestPassed = validation.success
        await session.save()
        
        response.status(200)
    } else {
        logger.error('Invalid turnstile verification: ', validation['error-codes'])
        response.status(400).json({ message: 'Turnstile verification failed.'})
    }

    response.end();
});

export default router;