#!/usr/bin/env node
import compression from 'compression'
import dotenv from 'dotenv'
import express, { Request, Response, NextFunction } from 'express'

import RateLimit from 'express-rate-limit'

import logger from './src/logger.js'
import captchaRouter from './src/routes/captcha.js'
import jobRouter from './src/routes/job.js'
import profileRouter from './src/routes/profile.js'
import verifyRouter from './src/routes/verify.js'
import gdprRouter from './src/routes/gdpr.js'

import { POST_PROCESSING_REPLACER, POST_PROCESSING_REVIVER } from './src/models/job.js'

// Read .env file
dotenv.config()

const app = express()
const port = process.env.NT_PORT || 3333

const REQUIRED_ENV_VARS = ['NT_CAPTCHA_SITEKEY', 'NT_CAPTCHA_SECRET']
for (const v of REQUIRED_ENV_VARS) {
    if (!process.env[v]) {
        throw new Error(`Missing required env variable ${v}`)
    }
}

const limiter = RateLimit({
    windowMs: parseInt(process.env.NT_RATELIMIT_WINDOW_MS!) || 60_000,
    max: parseInt(process.env.NT_RATELIMIT_MAX!) || 30
})

// Configure express
if (process.env.NT_RATELIMIT_TRUST_PROXY) {
    app.set('trust proxy', process.env.NT_RATELIMIT_TRUST_PROXY.split(',').map(e => e.trim()))
}

// Monkey patch send/render to get a good stack trace for ERR_HTTP_HEADERS_SENT errors.
app.use((request: Request, response: Response, next: NextFunction) => {
    const render = response.render
    const send = response.send
    response.render = function renderWrapper(args) {
        Error.captureStackTrace(this)
        return render.apply(this, [args])
    }
    response.send = function sendWrapper(args: Parameters<typeof send>): ReturnType<typeof send> {
        try {
            return send.apply(this, [args])
        } catch (error: any) {
            console.error(`Error in response.send | ${error.code} | ${error.message} | ${(response as Response & { stack: string }).stack}`)
            throw error
        }
    }

    next()
})

app.use(limiter)
app.use(compression())

// Accept 'text/plain' and '*/json' as json content types.
app.use(express.json({ 
    reviver: POST_PROCESSING_REVIVER,
    type: ['*/json', 'text/plain']
}))

app.set('json replacer', POST_PROCESSING_REPLACER)

// Routers
app.use('/captcha', captchaRouter)
app.use('/job', jobRouter)
app.use('/verify', verifyRouter)
app.use('/profile', profileRouter)
app.use('/gdpr', gdprRouter)

app.listen(port, () => {
    logger.info(`listening at port ${port}`)
})