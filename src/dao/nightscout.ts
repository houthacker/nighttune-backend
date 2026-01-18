import { AutotuneConfig, AutotuneErrorType, JobId } from '../models/job.js'
import { NightscoutApi, NightscoutProfileStore as NightscoutProfileStoreT } from '../models/nightscout.js'
import { AutotuneResult } from '../services/recommendationsParser.js'

type NightscoutProfileStore = typeof NightscoutProfileStoreT.infer

export type AutotuneError = { data: { jobId: JobId, exitCode: number, type: AutotuneErrorType, log: string }, autotuneLogFile: string | undefined }
export type AutotuneCallback = ( error: AutotuneError | null, recommendations?: AutotuneResult) => Promise<void>

export class NightscoutDao {

    private readonly api: NightscoutApi

    constructor(api: NightscoutApi) {
        this.api = api
    }

    /**
     * Verifies whether the Nightscout API can be accessed using the given url and optional token.
     * 
     * @param url The Nightscout base url.
     * @param token The access token, required if the Nightscout instance is locked down.
     * @returns Whether the Nightscout API could be accessed.
     */
    async verify(url: URL, token?: string): Promise<boolean> {
        return await this.api.verify(url, token)
    }

    async profileStore(url: URL, token?: string): Promise<NightscoutProfileStore> {
        return await this.api.profileStore(url, token)
    }

    /**
     * Runs autotune using the given configuration.
     * The callback could be used to handle errors or store the result.
     */
    async autotune(config: AutotuneConfig, callback: AutotuneCallback) {
        return await this.api.autotune(config, callback)
    }

    /**
     * Upload `profile` to the Nightscout site at `url`. This method returns a rejected
     * promise if uploading the profile fails.
     * 
     * @param profile The Nightscout profile to upload.
     * @param url The Nightscout site URL.
     * @param token The optional Nightscout access token.
     * 
     * @throws `UnauthorizedError` if the Nightscout site returns an HTTP 401 status
     * @throws `Error` In all other error cases.
     */
    async createProfile(profile: NightscoutProfileStore, url: URL, token?: string): Promise<void> {
        return await this.api.createProfile(profile, url, token)
    }
}