import { OptionalService } from '../models/services.js'

function all(vars: any[]): boolean {
    return !vars.some((v) => v === undefined || String(v).trim().length === 0)
}

/**
 * Scan the process environment to determine enabled optional services for the current runtime.
 */
export function scanEnabledOptionalServices(): void {
    const scannedServices = new Set<OptionalService>()

    // Captcha service scanning
    const captchaEnvVars: any[] = [process.env.NT_CAPTCHA_SITEKEY, process.env.NT_CAPTCHA_SECRET]
    if (all(captchaEnvVars)) {
        scannedServices.add(OptionalService.Captcha)
    }

    // Mail service scanning
    const mailEnvVars: any[] = [
        process.env.NT_MAIL_APIKEY_PUBLIC, 
        process.env.NT_MAIL_APIKEY_PRIVATE, 
        process.env.NT_MAIL_SENDER_ADDRESS,
        process.env.NT_MAIL_SENDER_NAME,
    ]
    if (all(mailEnvVars)) {
        scannedServices.add(OptionalService.Sendmail)
    }

    globalThis.enabledServices = scannedServices
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