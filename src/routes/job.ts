import type { Request, Response } from 'express';
import type { CorsOptions } from 'cors';

import cors from 'cors';
import { Router } from 'express';
import { type } from 'arktype'
import { inspect } from 'node:util';

import { AutotuneJob } from '..//models/job.js';
import { getSession } from '../controllers/sessionController.js';


const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
};
const router = Router();

// Handle CORS preflight
router.options('/', cors(corsOptions));

// Turnstile verification
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response);

    if (session.turnstileTestPassed === true) {
        const jobRequest = AutotuneJob(request.body);

        if (jobRequest instanceof type.errors) {
            response.status(400).json({ message: jobRequest.summary });
        } else {
            console.log('Job request: ');
            console.log(inspect(jobRequest));
            response.status(200);
        }
    } else {
        console.error('Client has not (yet) passed turnstile test.');
        response.status(400).json({ message: 'Please verify turnstile test first.'});
    }

    response.end();
});

export default router;