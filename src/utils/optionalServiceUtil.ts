import { OptionalService } from '../models/services.js'

/**
 * Scan the process environment to determine enabled optional services for the current runtime.
 */
export function scanEnabledOptionalServices(): void {

    // Determine whether the captcha environment variables are missing or empty.
    const captchaEnvVars: any[] = [process.env.NT_CAPTCHA_SITEKEY, process.env.NT_CAPTCHA_SECRET]
    const captchaEnabled = !captchaEnvVars.some((v) => v === undefined || String(v).trim().length === 0)

    const enabledSerbvices = new Set<OptionalService>()
    if (captchaEnabled) {
        enabledSerbvices.add(OptionalService.Captcha)
    }

    globalThis.enabledServices = enabledSerbvices
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