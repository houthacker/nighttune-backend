import { OptionalService, unsafeIsEnabled } from '../models/services.js'

/**
 * Scan the process environment to determine enabled optional services for the current runtime.
 */
export function scanEnabledOptionalServices(): void {
    const _enabledServices = new Set<OptionalService>()

    function scan(service: OptionalService) {
        if (unsafeIsEnabled(service)) {
            _enabledServices.add(service)
        } else {
            // Log to the console and do not use the logger, since this file is imported before
            // the instrumentation runs.
            console.debug(`[service-scanner] Disabling ${service} service because the related environment variables are not configured.`)
        }
    }

    // Scan optional services
    scan(OptionalService.Captcha)
    scan(OptionalService.Sendmail)
    scan(OptionalService.DistributedTracing)

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
