import { type } from 'arktype'
import { AutotuneErrorType, Unit, JobId, AutotuneConfig } from '@models/job.js'
import { AutotuneResult } from '@services/recommendationsParser.js'

export enum NightscoutApiVersion {
    /**
     * Nightscout API version 1
     */
    v1 = 1,

    /**
     * Nightscout API version 3
     */
    v3 = 3,
}

export type AutotuneError = { data: { jobId: JobId, exitCode: number, type: AutotuneErrorType, log: string }, autotuneLogFile: string | undefined }
export type AutotuneCallback = ( error: AutotuneError | null, recommendations?: AutotuneResult) => Promise<void>

export class UnauthorizedError extends Error {
    
    constructor(message: string, cause?: any) {
        super(message, { cause })
    }
}

/**
 * An `AccessDeniedError` os thrown when access to the requested
 * resource is denied.
 */
export class AccessDeniedError extends Error {

    constructor(message: string, cause?: any) {
        super(message, { cause })
    }
}

export class NoSuchProfileError extends Error {
    public readonly profileName: string

    constructor(profileName: string, message: string, cause?: any) {
        super(message, { cause })

        this.profileName = profileName
    }
}

/**
 * A `ProfileModificationError` is thrown when an attempt is made to
 * modify a read-only profile. 
 */
export class ProfileModificationError extends Error {

    constructor(message: string, cause?: any) {
        super(message, { cause })
    }
}

export class ProfileAlreadyExistsError extends Error {
    public readonly profileName: string

    constructor(profileName: string, message: string, cause?: any) {
        super(message, { cause })

        this.profileName = profileName
    }
}

export const TimedValue = type({
    time: "string",

    "timeAsSeconds?": type("number.integer >= 0").or(type("string.integer.parse").to("number.integer >= 0")),

    value: type("number >= 0").or(type("string.numeric.parse").to("number >= 0")),

    "minutes?": type("number.integer >= 0").or(type("string.integer.parse").to("number.integer >= 0")),

    "start?": "string"
})

export const NightscoutProfile = type({
    dia: type("number >= 0").or(type("string.numeric.parse").to("number >= 0")),

    timezone: "string",

    "carbs_hr?": type("string.numeric.parse | number").narrow((n, ctx) => 
        n < 0 ? ctx.mustBe("positive") : true
    ),

    "delay?": "string.numeric.parse | number",

    "startDate?": "string",

    "units?": Unit,

    carbratio: TimedValue.array(),

    sens: TimedValue.array(),

    basal: TimedValue.array(),

    target_low: TimedValue.array(),

    target_high: TimedValue.array(),
})

export const NightscoutProfileStore  = type({
    "_id?": "string",

    defaultProfile: "string",

    "date?": "number.integer > 0",

    "created_at?": "string",

    startDate: "string",

    "app?": "string",

    "utcOffset?": "number.integer",

    "identifier?": "string",

    "srvModified?": "number.integer",

    "srvCreated?": "number.integer",

    "subject?": "string",

    "mills?": "string.integer.parse | number.integer",

    "units?": Unit,

    store: type({"[string]": NightscoutProfile}),
})

export interface NightscoutApi {

    /**
     * Verifies whether the Nightscout API can be accessed using the given url and optional token.
     * 
     * @param url The Nightscout base url.
     * @param token The optional access token. Required if the Nightscout instance is locked down.
     * @returns Whether the Nightscout API could be accessed.
     */
    verify(url: URL, token?: string): Promise<boolean>

    /**
     * Validates that the Nightscout instance has at least `days` days of data.
     * 
     * @param url The Nightscout base url.
     * @param days The amount of days of data required.
     * @param timezone The time zone to calculate the timestamp for data availability. Defaults to `"UTC"`.
     * @param token The optional access token. Required if the Nightscout instance is locked down.
     * @returns Whether the Nightscout instance has the required amount of data.
     */
    haveRetainedData(url: URL, days: number, timezone: string, token?: string): Promise<boolean>

    /**
     * Retrieve the latest Nightscout profile store.
     * 
     * @param url The Nightscout base url.
     * @param token The optional access token. Required if the Nightscout instance is locked down.
     * @returns The Nightscout profile store.
     * @throws `Error` If an error occurs while querying the Nightscout API
     */
    profileStore(url: URL, token?: string): Promise<typeof NightscoutProfileStore.infer>

    /**
     * Run autotune using the given configuration.
     * 
     * **Note:** This always uses the Nightscout v1 api.
     * 
     * @param config The autotune configuration
     * @return The autotune result.
     */
    autotune(config: AutotuneConfig, callback: AutotuneCallback): Promise<void>

    /**
     * Upload `profile` to the Nightscout site . This method returns a rejected
     * promise if uploading the profile fails.
     * 
     * @param profile The Nightscout profile to upload.
     * @param nsUrl The Nightscout site URL.
     * @param token The optional Nightscout access token.
     * 
     * @throws `UnauthorizedError` if the Nightscout site returns an HTTP 401 status
     * @throws `Error` In all other error cases.
     */
    createProfile(profile: typeof NightscoutProfileStore.infer, url: URL, token?: string): Promise<void>
}