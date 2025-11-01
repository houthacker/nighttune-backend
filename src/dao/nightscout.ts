import { tz } from '@date-fns/tz'
import { format, startOfYesterday, subDays } from 'date-fns'
import { spawn } from 'node:child_process'
import { subtle } from 'node:crypto'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { AutotuneResult } from '../services/recommendationsParser.js'

import { AutotuneConfig, AutotuneErrorType, JobId } from '../models/job.js'

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
export type AutotuneCallback = (error: AutotuneError | null, recommendations?: AutotuneResult) => void

export class NightscoutDao {

    /**
     * Verifies whether the Nightscout API can be accessed using the given url and optional token.
     * 
     * @param url The Nightscout base url.
     * @param token The access token, required if the Nightscout instance is locked down.
     * @returns Whether the Nightscout API could be accessed.
     */
    async verify(url: string, token?: string): Promise<boolean> {
        const statusUrl = new URL('/api/v1/status.json', url)

        if (token) {
            statusUrl.searchParams.append('token', await hash_access_token(token))
        }

        try {
            const response = await fetch(statusUrl)
            
            if (response.ok) {
                return true
            }

            console.error(`Nightscout API verification failed. HTTP ${response.status}: ${response.statusText}`)
        } catch (error) {
            console.error('Nightscout API verification failed: ', error)
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
        const tempdir = await fs.mkdtemp('/tmp/autotune')
        console.log(`Preparing oref0-autotune directory structure in ${tempdir}`)
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
            detached: false,
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
                console.log('Autotune successful, processing results.')
                
                const autotune_log = join(tempdir, 'autotune', process.env.NT_AUTOTUNE_RECOMMENDATIONS_FILE!)
                const recommendations = await AutotuneResult.parseLog(autotune_log, {
                    jobId: config.id,
                    nsHost: config.job.nightscout_url,
                    dateFrom: startDate.toDateString(),
                    dateTo: endDate.toDateString(),
                    uam: config.job.settings.uam_as_basal,
                    autotuneVersion: '0.7.1' // TODO read from manifest
                })
                callback(null, recommendations)                
            } else {
                const error = {
                    jobId: config.id,
                    exitCode: code,
                    type: AutotuneErrorType.AutotuneFailed,
                    log: chunks_to_string(autotune_err)
                }
                callback(error)
            }
        })

    }
}