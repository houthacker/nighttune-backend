import type { CorsOptions } from 'cors'
import type { Request, Response } from 'express'

import cors from 'cors'
import { Router } from 'express'

import { getSession } from '../controllers/sessionController.js'
import { validateCaptcha } from '../controllers/captchaController.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}
const router = Router()

// Handle CORS preflight
router.options('/', cors(corsOptions))

// capjs CAPTCHA verification
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const ip = request.header('X-Forwarded-For') || request.ip!
    const validation = await validateCaptcha(request.body.token, ip)

    if (validation.success) {
        const session = await getSession(request, response)
        session.captchaTestPassed = validation.success
        await session.save()
        
        response.status(200).end()
    } else {
        response.status(400).json({ message: 'Captcha verification failed.'})
    }
})

export default router
