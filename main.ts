#!/usr/bin/env node
import express from 'express'
import compression from 'compression'
import dotenv from 'dotenv'

import RateLimit from 'express-rate-limit'

import logger from './src/logger.js'
import turnstileRouter from './src/routes/turnstile.js'
import jobRouter from './src/routes/job.js'
import verifyRouter from './src/routes/verify.js'
import profileRouter from './src/routes/profile.js'

import { POST_PROCESSING_REPLACER, POST_PROCESSING_REVIVER } from './src/models/job.js'

// Read .env file
dotenv.config()

const app = express()
const port = process.env.NT_PORT || 3333

if (!process.env.NT_TURNSTILE_SECRET) {
    throw new Error('Missing required env variable NT_TURNSTILE_SECRET')
}

const limiter = RateLimit({
    windowMs: parseInt(process.env.NT_RATELIMIT_WINDOW_MS!) || 60_000,
    max: parseInt(process.env.NT_RATELIMIT_MAX!) || 30
})

// Configure express
if (process.env.NT_RATELIMIT_TRUST_PROXY) {
    app.set('trust proxy', process.env.NT_RATELIMIT_TRUST_PROXY.split(',').map(e => e.trim()))
}
app.use(limiter)
app.use(compression())

// Accept 'text/plain' and '*/json' as json content types.
app.use(express.json({ 
    reviver: POST_PROCESSING_REVIVER,
    type: ['*/json', 'text/plain']
}))

app.set('json replacer', POST_PROCESSING_REPLACER)

// Routers
app.use('/turnstile', turnstileRouter)
app.use('/job', jobRouter)
app.use('/verify', verifyRouter)
app.use('/profile', profileRouter)

app.listen(port, () => {
    logger.info(`listening at port ${port}`)
})