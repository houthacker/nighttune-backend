import type { Request, Response } from 'express';
import type { CorsOptions } from 'cors';

import cors from 'cors';
import { Router } from 'express';

import { validateTurnstile } from '../controllers/turnstileController';

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || []
};
const router = Router();

// Handle CORS preflight
router.options('/', cors(corsOptions));

// Turnstile verification
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const ip = request.get('CF-Connecting-IP') || request.ip!;
    const validation = await validateTurnstile(request.body.token, ip);
    if (validation.success) {
        response.sendStatus(200);
    } else {
        console.error('Invalid verification: ', validation['error-codes']);
        response.send(400).json({ message: 'Turnstile verification invalid.'});
    }
});

export default router;