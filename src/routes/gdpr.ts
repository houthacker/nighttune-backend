import type { CorsOptions } from 'cors'
import type { NextFunction, Request, Response } from 'express'

import { Router } from 'express'
import cors from 'cors'
import compression from 'compression'

import { GDPRController } from '@controllers/gdprController.js'
import { getSession } from '@controllers/sessionController.js'
import { SqliteDao } from '@dao/sqlite.js'
import logger from '@/logger.js'
import { NIGHTSCOUT_TOKEN_MIN_LENGTH } from '@models/verify.js'
import { OptionalService } from '@models/services.js'
import { isServiceEnabled } from '@utils/optionalServiceUtil.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}
const router = Router()
const controller = new GDPRController(new SqliteDao(process.env.NT_DB_PATH!))

// All requests must have the session cookie, have passed the captcha- and Nightscout access test.
router.use(cors(corsOptions), async (request: Request, response: Response, next: NextFunction) => {
    const session = await getSession(request, response)

    if (isServiceEnabled(OptionalService.Captcha) && session.captchaTestPassed !== true) {
        logger.debug('Client has not (yet) passed captcha test.')
        response.status(403).json({ message: 'Please verify captcha test first.'})
    } else {
        try {
            new URL(session.verifiedNightscoutUrl || '')

            // Token is required to be at least NIGHTSCOUT_TOKEN_MIN_LENGTH characters.
            // @see https://github.com/nightscout/cgm-remote-monitor/blob/master/lib/authorization/storage.js#L162
            if (session.verifiedNightscoutToken === undefined) {
                logger.debug(`Denying client access to [${request.path}] because Nightscout access token is missing.`)
                response.status(403).json({ message: 'To use this endpoint, a valid Nightscout access token is required.'})
            } else {
                const tokenLength = session.verifiedNightscoutToken.length
                if (tokenLength < NIGHTSCOUT_TOKEN_MIN_LENGTH) {
                    logger.debug(`Denying client access to [${request.path}] because Nightscout token is too short (${tokenLength}/${NIGHTSCOUT_TOKEN_MIN_LENGTH})`)
                    response.status(403).json({message: 'Not a Nightscout access token. Are you using the ADMIN_TOKEN instead?'})
                } else {
                    return next()
                }
            }
        } catch (error) {
            logger.debug(`Denying client access to [${request.path}] because Nightscout URL is not verified.`)
            response.status(403).json({ message: 'You must verify your Nightscout URL first.'})
        }
    }
})

// Handle CORS preflight
router.options('/', cors(corsOptions))

/**
 * Get all data for the given Nightscout instance in a zip file containing formatted JSON.
 */
router.get('/', compression(), cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)
    
    try {
        const data = controller.retrieveData(new URL(session.verifiedNightscoutUrl!))
        response.status(200).json({ data })
    } catch (error: any) {
        logger.error(`Error while retrieving GDPR data for url [${session.verifiedNightscoutUrl}]:\n${JSON.stringify(error)}`)
        response.status(500).json({ message: 'Error while retrieving all GDPR data.'})
    }
})

/**
 * Delete all data for the given Nightscout instance and return it in a zip file containing formatted JSON.
 */
router.delete('/', compression(), cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)

    try {
        const data = controller.removeData(new URL(session.verifiedNightscoutUrl!))

        // If the data has been retrieved and removed successfully, also destroy the session cookie.
        session.destroy()
        
        response.status(200).json({ data })
    } catch (error: any) {
        logger.error(`Error while removing GDPR data for url [${session.verifiedNightscoutUrl}]:\n${JSON.stringify(error)}`)
        response.status(500).json({ message: 'Error while removing all GDPR data.'})
    }
})

export default router