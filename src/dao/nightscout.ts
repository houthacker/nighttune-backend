import { tz } from '@date-fns/tz'
import { format, startOfYesterday, subDays } from 'date-fns'
import { sgg } from 'ml-savitzky-golay-generalized'
import { spawn } from 'node:child_process'
import { subtle } from 'node:crypto'
import fs from 'node:fs/promises'
import { join } from 'node:path'

import logger from '../logger.js'
import { AutotuneConfig, AutotuneErrorType, AutotuneJob as AutotuneJobT, JobId, SmoothingLevel } from '../models/job.js'
import { AutotuneResult, BasalRecommendation, PostProcessType } from '../services/recommendationsParser.js'

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

export type AutotuneError = { jobId: JobId, exitCode: number, type: AutotuneErrorType, log: string }
export type AutotuneCallback = (error: AutotuneError | null, recommendations?: AutotuneResult) => Promise<void>


/**
 * Smoothens the given basal recommendations in place by the given `level`.
 * 
 * @param level The smoothing intensity level.
 * @param recommendations The recommendations to smoothen.
 */
const smoothen = (level: SmoothingLevel, recommendations: Array<BasalRecommendation>): void => {
    if (level === 'none') {
        return
    }

    const recommendedValues = recommendations.map(r => r.recommendedValue)
    const filtered = sgg(recommendedValues, 1, smoothingOptions[level])

    recommendations.forEach((r, i) => {
        r.postProcessed.set(PostProcessType.SMOOTH, filtered[i])
    })
}

export class NightscoutDao {

    /**
     * Verifies whether the Nightscout API can be accessed using the given url and optional token.
     * 
     * @param url The Nightscout base url.
     * @param token The access token, required if the Nightscout instance is locked down.
     * @returns Whether the Nightscout API could be accessed.
     */
    async verify(url: URL, token?: string): Promise<boolean> {
        const statusUrl = new URL('/api/v1/status.json', url)

        if (token) {
            statusUrl.searchParams.append('token', await hash_access_token(token))
        }

        try {
            const response = await fetch(statusUrl)
            
            if (response.ok) {
                return true
            }

            logger.warn(`Verification of Nightscout API at '${url.href}' failed: HTTP ${response.status} (${response.statusText}) `)
        } catch (error) {
            logger.error(`Verification of Nightscout API at '${url.href}' failed: \n`, error)
        }
        
        return false;
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
        // TODO have dir removed after run
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
        const oref0_autotune = spawn('oref0-autotune', 
        [
            `--dir=${tempdir}`,
            `--ns-host=${config.job.nightscout_url}`,
            `--start-date=${format(startDate, 'yyyy-MM-dd')}`,
            `--end-date=${format(endDate, 'yyyy-MM-dd')}`,
            `--categorize-uam-as-basal=${config.job.settings.uam_as_basal}`
        ],
        {
            // TODO causes zombie?
            detached: true,
            env: {...process.env, 'API_SECRET': token},
            shell: '/usr/bin/bash',
            stdio: ['pipe', 'ignore', 'pipe'],
            timeout: 5 * 60 * 1000
        })

        // Only capture errors since autotune output will be stored in files as well.
        oref0_autotune.stderr.on('data', (chunk: Buffer | string) => {
            autotune_err.push(chunk)
        })

        oref0_autotune.on('close', async (code: number) => {
            const ok = code === 0
            if (ok) {
                logger.debug(`[${config.job.nightscout_url}] Autotune successful.`)
                
                const autotune_log = join(tempdir, 'autotune', process.env.NT_AUTOTUNE_RECOMMENDATIONS_FILE!)
                const recommendations = await AutotuneResult.parseLog(autotune_log, {
                    jobId: config.id,
                    nsHost: config.job.nightscout_url,
                    dateFrom: startDate.toISOString(),
                    dateTo: endDate.toISOString(),
                    uam: config.job.settings.uam_as_basal,
                    autotuneVersion: '0.7.1', // TODO read from manifest
                    timeZone: config.job.settings.oaps_profile_data.timezone,
                    emailAddress: config.job.settings.email_address,
                    basalIncrement: config.job.settings.pump_basal_increment,
                })

                if (config.job.settings.basal_smoothing !== 'none') {
                    smoothen(config.job.settings.basal_smoothing, recommendations.find_basal())
                }
                await callback(null, recommendations)                
            } else {
                const error = {
                    jobId: config.id,
                    exitCode: code,
                    type: AutotuneErrorType.AutotuneFailed,
                    log: chunks_to_string(autotune_err)
                }
                await callback(error)
            }
        })

    }
}