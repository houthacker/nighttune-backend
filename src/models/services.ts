
export const enum OptionalService {
     /**
      * Service to check if the frontend user is a real person.
      */
     Captcha = 'captcha',

     /**
      * Service to send job reports by mail.
      */
     Sendmail = 'mail',

     /**
      * Service to enable distributed tracing.
      */
     DistributedTracing = 'dtrace',
}

/**
 * Required environment variables used to configure the respective services.
 */
export const ServiceEnvVars = {
     [OptionalService.Captcha]: [
        process.env.NT_CAPTCHA_SERVER_URL,
        process.env.NT_CAPTCHA_SITEKEY, 
        process.env.NT_CAPTCHA_SECRET
    ],
     [OptionalService.Sendmail]: [
        process.env.NT_MAIL_APIKEY_PUBLIC, 
        process.env.NT_MAIL_APIKEY_PRIVATE, 
        process.env.NT_MAIL_SENDER_ADDRESS,
        process.env.NT_MAIL_SENDER_NAME,
    ],
    [OptionalService.DistributedTracing]: [
        process.env.NT_DTRACE_SERVICE_NAME,
        process.env.NT_DTRACE_URL,
        process.env.NT_DLOG_URL,
    ]
}

/**
 * A `ServiceError` is thrown when a service like `OptionalService.Sendmail` is enabled
 * but it isn't provided where required.
 */
export class ServiceError extends Error {
    public readonly service: OptionalService

    constructor(service: OptionalService, message: string, cause?: any) {
        super(message, { cause })
        Error.captureStackTrace(this, this.constructor)

        this.service = service
    }
}

/**
 * Determines if the given service is enabled by scanning the required
 * environment variables for this service. This method is safe if executed
 * once (i.e. at the start of the application), but later scans may result
 * in a different outcome since environment variables can change at any point
 * in time.
 * 
 * To use the safe version, use `isServiceEnabled` which caches the results of
 * this method.
 * 
 * @param service The service to check.
 * @returns Whether the service is enabled.
 */
export function unsafeIsEnabled(service: OptionalService): boolean {
    const vars = ServiceEnvVars[service]
    return !vars.some((v) => v === undefined || String(v).trim().length === 0)
}

