import type { Request, Response } from 'express';
import type { CorsOptions } from 'cors';

import cors from 'cors';
import { Router } from 'express';

import { validateTurnstile } from '../controllers/turnstileController.js';
import { getSession } from '../controllers/sessionController.js';

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
};
const router = Router();

// Handle CORS preflight
router.options('/', cors(corsOptions));

// Turnstile verification
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const ip = request.get('CF-Connecting-IP') || request.ip!;
    const validation = await validateTurnstile(request.body.token, ip);

    const session = await getSession(request, response);
    session.turnstileTestPassed = validation.success;
    await session.save();

    if (validation.success) {
        response.status(200);
    } else {
        console.error('Invalid turnstile verification: ', validation['error-codes']);
        response.status(400).json({ message: 'Turnstile verification failed.'});
    }

    response.end();
});

export default router;