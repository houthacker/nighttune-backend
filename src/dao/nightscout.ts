import { tz } from '@date-fns/tz'
import { format, startOfYesterday, subDays } from 'date-fns'
import { sgg } from 'ml-savitzky-golay-generalized'
import { spawn } from 'node:child_process'
import { subtle } from 'node:crypto'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { join } from 'node:path'
import { type } from 'arktype'

import logger from '../logger.js'
import { NightscoutProfileStore as NightscoutProfileStoreT, UnauthorizedError } from '../models/nightscout.js'
import { AutotuneConfig, AutotuneErrorType, AutotuneJob as AutotuneJobT, JobId, SmoothingLevel } from '../models/job.js'
import { AutotuneResult, BasalRecommendation, PostProcessType } from '../services/recommendationsParser.js'

const shell_executable = (): string => {
    const shell = process.env.SHELL!

    try {
        const stat = fsSync.statSync(shell)
        if (stat.isFile()) {
            return shell
        }

        throw new Error(`No such shell ${shell}`)
    } catch (error: any) {
        throw new Error(`stat() failed: ${error.message}`)
    }
}

type NightscoutProfileStore = typeof NightscoutProfileStoreT.infer
type SmoothingLevel = typeof AutotuneJobT.infer.settings.basal_smoothing
const smoothingOptions = {
    low: { 
        windowSize: 11,
        polynomial: 6,
    },
    medium: { 
        windowSize: 17,
        polynomial: 5,
    },
    high: { 
        windowSize: 23,
        polynomial: 3,
    }
}

const roundDownToOdd = (n: number): number => {
    return 2 * (Math.trunc((n - 1) / 2) ) + 1
}

const hash_access_token = async (token: string): Promise<string> => {
    const encoder = new TextEncoder()
    const encoded_token = encoder.encode(token)
    const hash_buffer = await subtle.digest('SHA-1', encoded_token)
    return Array.from(new Uint8Array(hash_buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
}

function chunks_to_string(chunks: Buffer[]): string
function chunks_to_string(chunks: string[]): string
function chunks_to_string(chunks: any[]): string {
    if (chunks.length > 0) {
        if (chunks[0] instanceof Buffer) {
            return Buffer.concat(chunks as Buffer[]).toString()
        }

        return (chunks as string[]).join('')
    }

    return ''
}

export type AutotuneError = { data: { jobId: JobId, exitCode: number, type: AutotuneErrorType, log: string }, autotuneLogFile: string | undefined }
export type AutotuneCallback = ( error: AutotuneError | null, recommendations?: AutotuneResult) => Promise<void>

/**
 * Smoothens the given basal recommendations in place by the given `level`.
 * 
 * @param level The smoothing intensity level.
 * @param recommendations The recommendations to smoothen.
 */
const smoothen = (level: SmoothingLevel, recommendations: Array<BasalRecommendation>): void => {
    if (level === 'none') {
        return
    } else if (recommendations.length < 5) {
        logger.debug('Smoothing skipped: smoothing less than 5 recommendations is not accepted by smoothing algorithm.')
        return
    }

    const recommendedValues = recommendations.map(r => r.recommendedValue)
    const settings = {
        ...smoothingOptions[level],
        windowSize: Math.min(smoothingOptions[level].windowSize, roundDownToOdd(recommendedValues.length)),
    }
    const filtered = sgg(recommendedValues, 1, settings)

    recommendations.forEach((r, i) => {
        r.postProcessed.set(PostProcessType.SMOOTH, filtered[i])
    })
}

/**
 * If present, encode and add the given token to the url query parameter 'token'.
 * If token is not present, this method just returns the given URL.
 * @returns The URL with the added query parameter.
 */
const addToken = async (url: URL, token?: string): Promise<URL> => {
    if (token) {
        const encoder = new TextEncoder()
        const data = encoder.encode(token)
        const hash_buffer = await crypto.subtle.digest('SHA-1', data)
        const hash_array = Array.from(new Uint8Array(hash_buffer))
        url.searchParams.append('token', hash_array
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
        )
    }

    return url
}

const findAutotuneLogFile = async (tempdir: string): Promise<string | undefined> => {
    const matches = await fs.readdir(join(tempdir, 'autotune')).then(files => {
        const regex = /autotune\..*\.log/g
        return files.filter(f => f.match(regex))
    }, () => [])

    return matches.length === 1 ? join(tempdir, 'autotune', matches[0]) : undefined
}

export class NightscoutDao {

    private readonly shell: string

    constructor() {
        // If there is no shell in the $SHELL env variable, calling
        // this method here will prevent nighttune-backend from starting up.
        this.shell = shell_executable()
    }

    /**
     * Verifies whether the Nightscout API can be accessed using the given url and optional token.
     * 
     * @param url The Nightscout base url.
     * @param token The access token, required if the Nightscout instance is locked down.
     * @returns Whether the Nightscout API could be accessed.
     */
    async verify(url: URL, token?: string): Promise<boolean> {
        const statusUrl = await addToken(new URL('/api/v1/status.json', url), token)

        try {
            const response = await fetch(statusUrl)
            
            if (response.ok) {
                return true
            }

            logger.warn(`Verification of Nightscout API at '${url.href}' failed: HTTP ${response.status} (${response.statusText}) `)
        } catch (error: any) {
            logger.error(`Verification of Nightscout API at '${url.href}' failed: \n${JSON.stringify(error)}`)
        }
        
        return false;
    }

    async profiles(nsUrl: URL, token?: string): Promise<NightscoutProfileStore> {
        const url = await addToken(new URL("api/v1/profile.json?count=1", nsUrl), token)

        try {
            const response = await fetch(url)

            if (response.ok) {
                const body = await response.json() as any[]
                const stores = NightscoutProfileStoreT.array()(body)

                // Required for backwards compatibility
                // TODO Remove after successfully running without errors for some time.
                if (stores instanceof type.errors) {
                    logger.error(`Falling back to lenient parsing: Cannot strictly parse response body into NightscoutProfileStore[]:\n${stores.summary}`)
                    return Promise.resolve(body[0] as NightscoutProfileStore)
                }

                return Promise.resolve(stores[0])
            }

            logger.warn(`Failed to fetch user profiles from ${nsUrl.href}: HTTP ${response.status}: ${response.statusText}`)
            return Promise.reject(new Error(`Failed to fetch user profiles: NS instance returned HTTP error status ${response.status}`))
        } catch (error: any) {
            logger.warn(`Error while fethching user profiles from ${nsUrl.href}:\n${JSON.stringify(error)}`)
            return Promise.reject(new Error('Error while fetching user profiles.'))
        }
    }

    /**
     * Runs autotune using the given configuration.
     * The callback could be used to handle errors or store the result.
     */
    async autotune(config: AutotuneConfig, callback: AutotuneCallback) {
        const token = config.job.nightscout_access_token ? `token=${await hash_access_token(config.job.nightscout_access_token)}` : ''
        const endDate = startOfYesterday({ in: tz(config.job.settings.oaps_profile_data.timezone) })
        const startDate = subDays(endDate, config.job.settings.autotune_days)

        // Prepare autotune working directory structure
        const tempdir = await fs.mkdtemp('/tmp/autotune')
        logger.debug(`[${config.job.nightscout_url}] Preparing oref0-autotune directory structure in ${tempdir}`)
        const settingsPath = join(tempdir, 'settings')
        await fs.mkdir(settingsPath)

        // Create required json files
        const profilePath = join(settingsPath, 'profile.json')
        await fs.writeFile(profilePath, JSON.stringify(config.job.settings.oaps_profile_data))
        await fs.copyFile(profilePath, join(settingsPath, 'pumpprofile.json'))
        await fs.copyFile(profilePath, join(settingsPath, 'autotune.json'))
        
        // Spawn autotune in the background, but don't `unref()` it.
        // Also do not set shell to `true` or to a string, since that requires 
        // sanitizing the user input (config.*) first to prevent arbitrary
        // command execution.
        const autotune_err: any[] = []
        const command = 'oref0-autotune'
        const flags = [
            `--dir=${tempdir}`,
            `--ns-host=${config.job.nightscout_url}`,
            `--start-date=${format(startDate, 'yyyy-MM-dd')}`,
            `--end-date=${format(endDate, 'yyyy-MM-dd')}`,
            `--categorize-uam-as-basal=${config.job.settings.uam_as_basal}`
        ]

        const oref0_autotune = spawn(`${command} ${flags.join(' ')}`,
        {
            detached: true,
            env: {...process.env, 'API_SECRET': token},
            shell: this.shell,
            stdio: ['pipe', 'ignore', 'pipe'],
            timeout: 5 * 60 * 1000
        })

        // Only capture errors since autotune output will be stored in files as well.
        oref0_autotune.stderr.on('data', (chunk: Buffer | string) => {
            autotune_err.push(chunk)
        })

        oref0_autotune.on('close', async (code: number) => {
            const autotuneRecommendationsFile = join(tempdir, 'autotune', process.env.NT_AUTOTUNE_RECOMMENDATIONS_FILE!)
            const autotuneLogFile = await findAutotuneLogFile(tempdir)

            const ok = code === 0
            if (ok) {
                logger.debug(`[${config.job.nightscout_url}] Autotune successful.`)

                const recommendations = await AutotuneResult.parseLog(autotuneRecommendationsFile, {
                    jobId: config.id,
                    nsHost: config.job.nightscout_url,
                    dateFrom: startDate.toISOString(),
                    dateTo: endDate.toISOString(),
                    uam: config.job.settings.uam_as_basal,
                    autotuneVersion: '0.7.1', // TODO read from manifest
                    timeZone: config.job.settings.oaps_profile_data.timezone,
                    emailAddress: config.job.settings.email_address,
                    basalIncrement: config.job.settings.pump_basal_increment,
                    basalSmoothing: config.job.settings.basal_smoothing,
                })

                try {
                    smoothen(config.job.settings.basal_smoothing, recommendations.find_basal())
                } catch (error: any) {
                    logger.error(`[job ${config.id}] Smoothing failed:\n${JSON.stringify(error)}`)
                }
                
                await callback(null, recommendations)                
            } else {
                await callback({
                    data: {
                        jobId: config.id,
                        exitCode: code,
                        type: AutotuneErrorType.AutotuneFailed,
                        log: chunks_to_string(autotune_err)
                    },
                    autotuneLogFile
                })
            }

            if (process.env.NT_AUTOTUNE_REMOVE_TEMP_DIRS! === 'true') {
                // Try to remove the temp directory containing the autotune files.
                try {
                    await fs.rm(tempdir, {
                        force: true,
                        recursive: true
                    })
                } catch(error: any) {
                    logger.warn(`[job ${config.id}] Could not remove autotune temp dir ${tempdir}.`)
                }
            }
        })

    }

    /**
     * Upload `profile` to the Nightscout site at `nsUrl`. This method returns a rejected
     * promise if uploading the profile fails.
     * 
     * @param profile The Nightscout profile to upload.
     * @param nsUrl The Nightscout site URL.
     * @param token The optional Nightscout access token.
     * 
     * @throws `UnauthorizedError` if the Nightscout site returns an HTTP 401 status
     * @throws `Error` In all other error cases.
     */
    async addProfile(profile: NightscoutProfileStore, nsUrl: URL, token?: string): Promise<void> {
        const url = await addToken(new URL("api/v1/profile", nsUrl), token)
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(profile)
        })

        if (response.ok) {
            return Promise.resolve()
        }

        switch (response.status) {
            case 401: throw new UnauthorizedError(nsUrl.href)
            default:
                const msg = `Could not add profile to Nightscout site at ${nsUrl.href}: HTTP response code was ${response.status}`
                logger.error(msg)
                return Promise.reject(new Error(msg))
        }
    }
}