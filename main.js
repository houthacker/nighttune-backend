#!/usr/bin/env node
import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';

import RateLimit from 'express-rate-limit';

// Read .env file
dotenv.config();

const app = express();
const port = process.env.NT_PORT || 3333;

if (!process.env.NT_TURNSTILE_SECRET) {
    throw new Error('Missing required env variable NT_TURNSTILE_SECRET');
}

// CORS configuration
const corsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || []
};

const limiter = RateLimit({
    windowMs: parseInt(process.env.NT_RATELIMIT_WINDOW_MS) || 60_000,
    max: process.env.NT_RATELIMIT_MAX || 30
});

// Configure express
if (process.env.NT_RATELIMIT_TRUST_PROXY) {
    app.set('trust proxy', process.env.NT_RATELIMIT_TRUST_PROXY.split(',').map(e => e.trim()));
}
app.use(limiter);
app.use(compression());
app.use(express.json({ type: ['*/json', 'text/plain']}));

const validateTurnstile = async (token, remote_ip) => {
    const formData = new FormData();
    formData.append('secret', process.env.NT_TURNSTILE_SECRET);
    formData.append('response', token);
    formData.append('remoteip', remote_ip);

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Turnstile validation error:', error);
        return { success: false, 'error-codes': ['internal-error']};
    }
};

app.options('/turnstile', cors(corsOptions));
app.post('/turnstile', cors(corsOptions), async (request, response) => {
    const ip = request.get('CF-Connecting-IP') || request.ip;

    const validation = await validateTurnstile(request.body.token, ip);
    if (validation.success) {
        console.log('Valid turnstile from:', validation.hostname);
        response.sendStatus(200);
    } else {
        console.error('Invalid verification');
        response.send(400).json({message: 'Verification invalid.'});
    }
});

app.listen(port, () => {
    console.log(`listening at port ${port}`)
});