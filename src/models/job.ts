import { TZDate } from '@date-fns/tz'
import { type } from 'arktype'

export const InsulinType = "'rapid-acting' | 'ultra-rapid' | '__default__'"
export const Unit = "'mg/dl' | 'mg/dL' | 'mmol' | 'mmol/l' | 'mmol/L'"
const SmoothingLevel = "'none' | 'low' | 'medium' | 'high'"


export const POST_PROCESSING_REPLACER = (k: any, v: any): any => {
    if (v instanceof Map) {
        return {
            dt: 'Map',
            v: [...v]
        }
    }

    return v
}

export const POST_PROCESSING_REVIVER = (k: any, v: any): any => {
    const isIterable = (x: any): boolean => {
        if (x === null) {
            return false
        }

        return typeof x[Symbol.iterator] === 'function'
    }
    
    if (v !== null && typeof v === 'object' && v.dt === 'Map' && isIterable(v.v)) {
        return new Map(v.v)
    }

    return v
}

export type JobId = string

export class JobError extends Error {
    public readonly jobId: JobId

    constructor(jobId: JobId, message: string, cause?: any) {
        super(message, { cause })
        Error.captureStackTrace(this, this.constructor)

        this.jobId = jobId
    }
}

export class JobAlreadyEnqueuedError extends JobError {
    public readonly tag = 'JobAlreadyEnqueuedError'

    constructor(jobId: JobId, message: string, cause?: any) {
        super(jobId, message, cause)
    }
}

export class GenericDatabaseError extends JobError {
    public readonly tag = 'GenericDatabaseError'

    constructor(jobId: JobId, message: string, cause?: any) {
        super(jobId, message, cause)
    }

}

export class JobExecutionError extends JobError {
    public readonly tag = 'JobExecutionError'

    constructor(jobId: JobId, message: string, cause?: any) {
        super(jobId, message, cause)
    }
}

export class NoSuchJobError extends JobError {
    public readonly tag = 'NoSuchJobError'

    constructor(jobId: JobId, message: string, cause?: any) {
        super(jobId, message, cause)
    }
}

export enum AutotuneErrorType {
    NightscoutVerificationFailed = 'NS_SITE_VERIFICATION_FAILED',
    AutotuneFailed = 'AUTOTUNE_FAILED'
}

export interface AutotuneConfig {

    /**
     * The job identifier
     */
    id: JobId

    /**
     * The autotune job configuration.
     */
    job: typeof AutotuneJob.infer
}

export const NormalizedTimedValue = type({
    /**
     * The time of day represented in seconds, e.g. `14400` for `04:00`.
     */
    timeAsSeconds: type("number.integer >= 0").or(type("string.integer.parse").to("number.integer >= 0")),

    /**
     * The time of day represented in minutes, e.g. `240` for `04:00`.
     */
    minutes: type("number.integer >= 0").or(type("string.integer.parse").to("number.integer >= 0")),

    /**
     * The time of day in a `%H:%M` representation, e.g. `14:00`.
     */
    time: "string",

    /**
     * The time of day in a `%H:%M:%S` representation, e.g. `14:00:00`.
     */
    start: "string",

    /**
     * The value to average.
     */
    value: type("number | string.numeric.parse"),
})

export const BasalTimeslot = type.merge(NormalizedTimedValue, {

    /**
     * The index of this timeslot within the containing array.
     */
    i: type("number.integer >= 0").or(type("string.integer.parse").to("number.integer >= 0")),

    /**
     * The basal rate of this time slot.
     */
    rate: type("number | string.numeric.parse"),
})

export const ScheduleSlot = type({

    /**
     * The index of this ratio within the containing array.
     */
    i: type("number.integer >= 0").or(type("string.integer.parse").to("number.integer >= 0")),

    /**
     * The start time of this time slot, formatted as %H:%M:%S.
     */
    start: "string",

    /**
     * The offset from 00:00 in minutes.
     */
    offset: type("number.integer | string.integer.parse"),
})

export const BgTimeslot = type.merge(ScheduleSlot, {

    /**
     * The lower bound of the bg target in `units`.
     */
    low: type("number | string.numeric.parse"),

    /**
     * The minimum bg in `units`.
     */
    min_bg: type("number | string.numeric.parse"),

    /**
     * The upper bound of the bg target in `units`.
     */
    high: type("number | string.numeric.parse"),

    /**
     * The maximum bg in `units`.
     */
    max_bg: type("number | string.numeric.parse"),
})

export const CarbRatioTimeslot = type.merge(ScheduleSlot, {
    
    /**
     * The Insulin / Carb Ratio
     */
    ratio: type("number | string.numeric.parse"),
})

export const SensitivityTimeslot = type.merge(ScheduleSlot, {

    /**
     * The Insulin Sensitivity Factor.
     */
    sensitivity: type("number | string.numeric.parse"),
})

export const OAPSProfile = type({

    /**
     * The maximum autosens factor. Defaults to 1.2.
     */
    autosens_max: type("number | string.numeric.parse"),

    /**
     * The minimum autosens factor. Defaults to 0.7.
     */
    autosens_min: type("number | string.numeric.parse"),

    /**
     * The basal profile timeslots.
     */
    basalprofile: BasalTimeslot.array(),

    /**
     * The carb ratio to use if only a single value is to be used.
     */
    carb_ratio: type("number | string.numeric.parse"),

    /**
     * The Duration of Insulin Activity.
     */
    dia: type("number >= 0").or(type("string.numeric.parse").to("number >= 0")),

    /**
     * The minimum carb absorption in grams, per 5 minutes.
     */
    min_5m_carbimpact: type("number >= 0").or(type("string.numeric.parse").to("number >= 0")),

    /**
     * The type of insulin, indicating how fast the insulin acts and decays.
     */
    curve: InsulinType,

    /**
     * The output units.
     */
    out_units: Unit,

    /**
     * The native time zone name, e.g. `Europe/Amsterdam`.
     */
    timezone: "string",

    /**
     * The blood glucose target time slots.
     */
    bg_targets: {
        units: Unit,
        user_preferred_units: Unit,
        targets: BgTimeslot.array(),
    },

    carb_ratios: {
        first: type("number.integer >= 0").or(type("string.integer.parse").to("number.integer >= 0")),

        /**
         * The carb units, defaults to 'grams'.
         */
        units: "'grams' | string",

        /**
         * The carb ratio time slots.
         */
        schedule: CarbRatioTimeslot.array(),
    },

    isfProfile: {
        first: type("number.integer >= 0").or(type("string.integer.parse").to("number.integer >= 0")),

        /**
         * The Insulin Sensitivity Factor time slots.
         */
        sensitivities: SensitivityTimeslot.array(),
    }
})

export const JobSettings = type({
    /**
     * The lowest autosens factor.
     */
    autosens_min: type("number > 0").or(type("string.numeric.parse").to("number > 0")),

    /**
     * The highest autosens factor.
     */
    autosens_max: type("number > 0").or(type("string.numeric.parse").to("number > 0")),

    /**
     * The name of the Nightscout profile.
     */
    profile_name: "string",

    /**
     * The minimum cab absorption per 5 minutes, in grams.
     */
    min_5m_carbimpact: type("number > 0").or(type("string.numeric.parse").to("number > 0")),
    
    /**
     * The minimum step of basal units the pump can handle.
     */
    pump_basal_increment: type("number | string.numeric.parse"),

    /**
     * Whether to count unannounced meals towards basal. 
     */
    uam_as_basal: "boolean",

    /**
     * The type of insulin used.
     */
    insulin_type: InsulinType,

    /**
     * How many days of nightscout history must be used for autotune.
     */
    autotune_days: type("number").narrow((n, ctx): boolean => {
        return n > 0 && n <= 30;
    }),

    /**
     * An optional e-mail address to send the autotune results to.
     */
    "email_address?": "string.email",

    /**
     * Whether to smooth the basal values to align them more with actual
     * physiological values. It defaults to 'none'.
     */
    "basal_smoothing": [type(SmoothingLevel), "=", "none"],

    /**
     * The (converted) OpenAPS profile.
     */
    oaps_profile_data: OAPSProfile,
})

export const AutotuneJob = type({

    /**
     * The URL of the nightscout instance to use.
     */
    nightscout_url: "string.url",

    /**
     * The optional access token to access the Nightscout instance.
     */
    "nightscout_access_token?": "string",

    /**
     * Job settings.
     */
    settings: JobSettings,
})

/**
 * A request to create a new Nightscout profile based on previous
 * job results. The `JobId` is passed as query parameter so only
 * the profile name is required here.
 */
export const CreateProfileRequest = type({

    /**
     * The name of the profile.
     */
    name: "string",
})

/**
 * Metadata of a single job.
 */
export class JobMeta {

    /**
     * The unique job identifier.
     */
    public readonly id: JobId

    /**
     * The current job status.
     */
    public readonly status: 'submitted' | 'processing' | 'error' | 'finished'

    /**
     * The used level of smoothing.
     */
    public readonly smoothing: typeof AutotuneJob.infer.settings.basal_smoothing

    /**
     * The time at which the job was submitted, in the profile time zone.
     */
    public readonly submittedAt: TZDate

    /**
     * The optional time at which the job finished, in the profile time zone.
     */
    public readonly doneAt: TZDate | undefined

    constructor(id: JobId, status: typeof this.status, smoothing: typeof this.smoothing, submittedAt: TZDate, doneAt: TZDate | undefined = undefined) {
        this.id = id
        this.status = status
        this.smoothing = smoothing
        this.submittedAt = submittedAt
        this.doneAt = doneAt
    }
}

/**
 * A description of a failed job.
 */
export class FailedJob {

    /**
     * The unique identifier of the related JobMeta.
     */
    public readonly job_id: JobId

    /**
     * The reason of failure.
     */
    public readonly error_code: AutotuneErrorType

    constructor(job_id: JobId, error_code: AutotuneErrorType) {
        this.job_id = job_id
        this.error_code = error_code
    }
}