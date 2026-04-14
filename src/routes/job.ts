import type { CorsOptions } from 'cors'
import type { NextFunction, Request, Response } from 'express'

import { type } from 'arktype'
import cors from 'cors'
import { Router } from 'express'

import { IronSession } from 'iron-session'
import { JobController } from '../controllers/jobController.js'
import { getSession } from '../controllers/sessionController.js'
import { MailjetDao } from '../dao/mail.js'
import { NightscoutDao } from '../dao/nightscout.js'
import { NightscoutApiFactory } from '../dao/nightscout/api.js'
import { SqliteDao } from '../dao/sqlite.js'
import logger from '../logger.js'
import { AutotuneJob, CreateProfileRequest, GenericDatabaseError, JobAlreadyEnqueuedError, JobExecutionError, NoSuchJobError } from '../models/job.js'
import { AccessDeniedError, NightscoutApiVersion, NoSuchProfileError, ProfileAlreadyExistsError, UnauthorizedError } from '../models/nightscout.js'
import { SessionData } from '../models/session.js'
import { ProfileService } from '../services/profileService.js'
import { OptionalService } from '../models/services.js'
import { isServiceEnabled } from '../utils/optionalServiceUtil.js'

const corsOptions: CorsOptions = {
    origin: process.env.NT_CORS_ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
}
const router = Router()

const createController = async (session: IronSession<SessionData>): Promise<JobController> => {
    return new JobController(
        new SqliteDao(process.env.NT_DB_PATH!), 
        new NightscoutDao(NightscoutApiFactory.getApi(session.nightscoutApiVersion)),
        new ProfileService(),
        isServiceEnabled(OptionalService.Sendmail) ? new MailjetDao() : undefined, 
    )
}

// All requests must have the session cookie, have passed the captcha- and Nightscout access test.
router.use(cors(corsOptions), async (request: Request, response: Response, next: NextFunction) => {
    const session = await getSession(request, response)

    if (isServiceEnabled(OptionalService.Captcha) && session.captchaTestPassed !== true) {
        logger.debug('Client has not (yet) passed captcha test.')
        response.status(403).json({ message: 'Please verify captcha test first.'})
    } else {
        try {
            new URL(session.verifiedNightscoutUrl || '')
            return next()
        } catch (error) {
            logger.debug(`Denying access to [${request.ip}] because Nightscout URL is not verified`)
            response.status(403).json({ message: 'Please verify the Nightscout URL and token first.'})
        }
    }
})

// POST a new job request
router.options('/', cors(corsOptions))
router.post('/', cors(corsOptions), async (request: Request, response: Response) => {
    const jobRequest = AutotuneJob(request.body)
    if (jobRequest instanceof type.errors) {
        logger.warn(`Request body not accepted: ${jobRequest.summary}`, jobRequest.summary)
        response.status(400).json({ message: jobRequest.summary })
    } else {

        try {
            const controller = await createController(await getSession(request, response))
            const jobId = await controller.submit(jobRequest)
            response.status(200).json({ jobId })
        } catch (error: any) {
            if (error instanceof JobAlreadyEnqueuedError) {
                logger.warn(`[job ${error.jobId}] job already enqueued.`)
                response.status(400).json({message: 'Job already enqueued.'})
            } else if (error instanceof GenericDatabaseError || error instanceof JobExecutionError) {
                logger.error(`[job ${error.jobId}] job execution failed:\n${JSON.stringify(error)}`)
                response.status(500).json({ jobId: error.jobId })
            } else {
                logger.error(`[job ${error.jobId}] generic job error:\n${JSON.stringify(error)}`)
                response.status(500).json({message: 'Generic error running job with unknown id.'})
            }
        }
    }
})

router.get('/id/:id', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)
    const controller = await createController(session)

    try {
        const result = await controller.result(new URL(session.verifiedNightscoutUrl!), request.params.id as string)
        if (result === undefined) {
            response.status(404).json({ message: `No such job '${request.params.id}'`})
        } else {
            response.status(200).json({ result })
        }
    } catch (error) {
        logger.error(`Error retrieving results of job '${request.params.id}' at Nightscout URL ${session.verifiedNightscoutUrl!}:\n${JSON.stringify(error)}`)
        response.status(500).json({message: 'Error while retrieving job results.'})
    }
})

router.options('/id/:id/create-ns-profile', cors(corsOptions))
router.post('/id/:id/create-ns-profile', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)
    const controller = await createController(session)
    const createProfileRequest = CreateProfileRequest(request.body)

    if (createProfileRequest instanceof type.errors) {
        logger.warn(`Request body not accepted: ${createProfileRequest.summary}`)
        response.status(400).json({ message: createProfileRequest.summary })
    } else if (session.nightscoutApiVersion !== NightscoutApiVersion.v3) {
        logger.error(`Cannot create profile for job ${request.params.id}: incorrect API version ${session.nightscoutApiVersion}`)
        response.status(400).json({message: `Wrong Nightscout API version ${session.nightscoutApiVersion}`})
    } else {

        try {
            await controller.createAndUploadProfile(createProfileRequest.name, request.params.id as string, new URL(session.verifiedNightscoutUrl!), session.verifiedNightscoutToken)
            response.status(200).end()
        } catch (error: any) {
            if (error instanceof UnauthorizedError) {
                logger.error(`Uploading profile for job ${request.params.id} failed: Unauthorized.`)
                response.status(407).json({message: 'Unauthorized. To create a profile at your site, an access token is required.'})
            } else if (error instanceof AccessDeniedError) {
                logger.error(`Insufficient permissions to create profile for job ${request.params.id} at ${error.message}`)
                response.status(403).json({message: 'Unauthorized. The token you provided has insufficient permissions.'})
            } else if (error instanceof NoSuchJobError) {
                logger.error(`Cannot create profile for job ${request.params.id}: ${error.message}`)
                response.status(404).json({message: `No such job ${request.params.id}`})
            } else if (error instanceof NoSuchProfileError) {
                logger.error(`Cannot create profile for job ${request.params.id}:\nProfile ${error.profileName} used to run job missing from store.`)
                response.status(410).json({message: `Autotune job profile ${error.profileName} missing from store.`})
            } else if (error instanceof ProfileAlreadyExistsError) {
                logger.error(`Cannot create profile for job ${request.params.id}: A profile named ${error.profileName} already exists.`)
                response.status(409).json({message: `A profile named ${error.profileName} already exists.`})
            } else {
                logger.error(`Error while creating a new profile at ${session.verifiedNightscoutUrl!} for job ${request.params.id}:\n${error.message}`)
                response.status(500).json({message: 'Error while creating profile.'})
            }
        }
    }
})

// GET the status of all current and previous jobs.
router.options('/all', cors(corsOptions))
router.get('/all', cors(corsOptions), async (request: Request, response: Response) => {
    const session = await getSession(request, response)
    const controller = await createController(session)

    try {
        const jobs = await controller.all(new URL(session.verifiedNightscoutUrl!))
        response.status(200).json({ jobs })
    } catch (error: any) {
        logger.error(`Error retrieving jobs:\n${JSON.stringify(error)}`)
        response.status(500).json({ message: 'Error retrieving jobs' })
    }
})

// GET the status of any queued job for the given Nightscout URL
router.get('/latest', cors(corsOptions), async(request: Request, response: Response) => {
    const session = await getSession(request, response)
    const controller = await createController(session)

    try {
        const job = await controller.latest(new URL(session.verifiedNightscoutUrl!))
        response.status(200).json({ job })
    } catch (error: any) {
        logger.error(`Error while retrieving latest job for URL '${session.verifiedNightscoutUrl!}':\n${JSON.stringify(error)}`)
        response.status(500).json({ message: 'Error retrieving latest job'})
    }
})

export default router