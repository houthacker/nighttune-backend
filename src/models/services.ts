
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
