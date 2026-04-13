import { OptionalService } from '../models/services.js'
import logger from '../logger.js'

function all(vars: any[]): boolean {
    return !vars.some((v) => v === undefined || String(v).trim().length === 0)
}

/**
 * Scan the process environment to determine enabled optional services for the current runtime.
 */
export function scanEnabledOptionalServices(): void {
    const _enabledServices = new Set<OptionalService>()

    function scan(service: OptionalService, vars: any[]) {
        if (all(vars)) {
            _enabledServices.add(service)
        } else {
            logger.debug(`Disabling ${service} service because the related environment variables are not configured.`)
        }
    }

    // Scan optional services
    scan(OptionalService.Captcha, [process.env.NT_CAPTCHA_SITEKEY, process.env.NT_CAPTCHA_SECRET])
    scan(OptionalService.Sendmail, [
        process.env.NT_MAIL_APIKEY_PUBLIC, 
        process.env.NT_MAIL_APIKEY_PRIVATE, 
        process.env.NT_MAIL_SENDER_ADDRESS,
        process.env.NT_MAIL_SENDER_NAME,
    ])
    scan(OptionalService.DistributedTracing, [
        process.env.NT_DTRACE_SERVICE_NAME,
        process.env.NT_DTRACE_URL,
        process.env.NT_DLOG_URL,
    ])

    globalThis.enabledServices = _enabledServices
}

/**
 * Return whether the given service has been enabled.
 */
export function isServiceEnabled(service: OptionalService): boolean {
    return globalThis.enabledServices.has(service)
}

/**
 * If `service` is enabled, run `fn`, else run `elseFn` if it has been provided.
 */
export function runIfEnabled(service: OptionalService, fn: () => void, elseFn: (() => void) | undefined = undefined): void {
    if (isServiceEnabled(service)) {
        fn()
    } else {
        if (elseFn !== undefined) {
            elseFn()
        }
    }
}
