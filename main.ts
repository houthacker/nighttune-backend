#!/usr/bin/env node

// Do *not* move this import downward.
import './instrumentation.js'

import 'dotenv/config'
import dotenv from 'dotenv'

import { OptionalService } from '@models/services.js'

// Declare global storage for enabled optional services
declare global {
    var enabledServices: Set<OptionalService>
}

import compression from 'compression'
import express, { NextFunction, Request, Response } from 'express'

import RateLimit from 'express-rate-limit'

import logger from '@/logger.js'
import captchaRouter from '@routes/captcha.js'
import gdprRouter from '@routes/gdpr.js'
import jobRouter from '@routes/job.js'
import profileRouter from '@routes/profile.js'
import verifyRouter from '@routes/verify.js'

import { POST_PROCESSING_REPLACER, POST_PROCESSING_REVIVER } from '@models/job.js'
import { runIfEnabled, scanEnabledOptionalServices } from '@utils/optionalServiceUtil.js'
import { exitIfMissing } from '@utils/environment.js'

// Read .env file
dotenv.config()

// Check for missing, mandatory env vars
exitIfMissing([
    'NODE_ENV', 
    'NT_AUTOTUNE_RECOMMENDATIONS_FILE', 
    'NT_CORS_ALLOWED_ORIGINS',
    'NT_DB_PATH', 
    'NT_IRON_SESSION_COOKIE_DOMAIN',
    'NT_IRON_SESSION_SECRET',
])

// Scan if optional services have been enabled and cache the result.
scanEnabledOptionalServices()

const app = express()
const port = process.env.NT_PORT || 3333

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
            logger.error(`Error in response.send | ${error.code} | ${error.message} | ${(response as Response & { stack: string }).stack}`)
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
runIfEnabled(OptionalService.Captcha, () => app.use('/captcha', captchaRouter))
app.use('/job', jobRouter)
app.use('/verify', verifyRouter)
app.use('/profile', profileRouter)
app.use('/gdpr', gdprRouter)

// Default response is 404
app.use((request: Request, response: Response, next: NextFunction) => {
    response.status(404).send()
})

app.listen(port, () => {
    logger.info(`listening at port ${port}`)
})