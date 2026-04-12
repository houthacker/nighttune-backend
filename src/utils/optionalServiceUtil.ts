import { OptionalService } from '../models/services.js'

/**
 * Calculate and return the set of enabled optional services for the current runtime.
 */
export function calculateEnabledOptionalServices():  Set<OptionalService> {

    // Determine whether the captcha environment variables are missing or empty.
    const captchaEnvVars: any[] = [process.env.NT_CAPTCHA_SITEKEY, process.env.NT_CAPTCHA_SECRET]
    const captchaEnabled = !captchaEnvVars.some((v) => v === undefined || String(v).trim().length === 0)

    const enabled = new Set<OptionalService>()
    if (captchaEnabled) {
        enabled.add(OptionalService.Captcha)
    }

    return enabled
}

/**
 * Return whether the given service has been enabled.
 */
export function isServiceEnabled(service: OptionalService): boolean {
    return globalThis.enabledServices.has(service)
}