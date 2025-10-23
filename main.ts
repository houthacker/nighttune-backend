#!/usr/bin/env node
import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';

import RateLimit from 'express-rate-limit';

import turnstileRouter from './src/routes/turnstile.js';
import jobRouter from './src/routes/job.js';

// Read .env file
dotenv.config();

const app = express();
const port = process.env.NT_PORT || 3333;

if (!process.env.NT_TURNSTILE_SECRET) {
    throw new Error('Missing required env variable NT_TURNSTILE_SECRET');
}

const limiter = RateLimit({
    windowMs: parseInt(process.env.NT_RATELIMIT_WINDOW_MS!) || 60_000,
    max: parseInt(process.env.NT_RATELIMIT_MAX!) || 30
});

// Configure express
if (process.env.NT_RATELIMIT_TRUST_PROXY) {
    app.set('trust proxy', process.env.NT_RATELIMIT_TRUST_PROXY.split(',').map(e => e.trim()));
}
app.use(limiter);
app.use(compression());

// Accept 'text/plain' and '*/json' as json content types.
app.use(express.json({ type: ['*/json', 'text/plain']}));

// Routers
app.use('/turnstile', turnstileRouter);
app.use('/job', jobRouter);

app.listen(port, () => {
    console.log(`listening at port ${port}`)
});