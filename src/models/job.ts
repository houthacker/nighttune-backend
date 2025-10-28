import { type } from 'arktype';

export const InsulinType = "'rapid-acting' | 'ultra-rapid' | '__default__'"
export const InsulineUnit = "'mmol' | 'mg/dL'"
export type JobId = string

export const NormalizedTimedValue = type({
    /**
     * The time of day represented in seconds, e.g. `14400` for `04:00`.
     */
    timeAsSeconds: "number.integer",

    /**
     * The time of day represented in minutes, e.g. `240` for `04:00`.
     */
    minutes: "number.integer",

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
    value: "number",
})

export const BasalTimeslot = type.merge(NormalizedTimedValue, {

    /**
     * The index of this timeslot within the containing array.
     */
    i: "number.integer",

    /**
     * The basal rate of this time slot.
     */
    rate: "number",
})

export const ScheduleSlot = type({

    /**
     * The index of this ratio within the containing array.
     */
    i: "number.integer",

    /**
     * The start time of this time slot, formatted as %H:%M:%S.
     */
    start: "string",

    /**
     * The offset from 00:00 in minutes.
     */
    offset: "number.integer",
})

export const BgTimeslot = type.merge(ScheduleSlot, {

    /**
     * The lower bound of the bg target in `units`.
     */
    low: "number",

    /**
     * The minimum bg in `units`.
     */
    min_bg: "number",

    /**
     * The upper bound of the bg target in `units`.
     */
    high: "number",

    /**
     * The maximum bg in `units`.
     */
    max_bg: 'number',
})

export const CarbRatioTimeslot = type.merge(ScheduleSlot, {
    
    /**
     * The Insulin / Carb Ratio
     */
    ratio: "number",
})

export const SensitivityTimeslot = type.merge(ScheduleSlot, {

    /**
     * The Insulin Sensitivity Factor.
     */
    sensitivity: "number",
})

export const OAPSProfile = type({

    /**
     * The maximum autosens factor. Defaults to 1.2.
     */
    autosens_max: "number",

    /**
     * The minimum autosens factor. Defaults to 0.7.
     */
    autosens_min: "number",

    /**
     * The basal profile timeslots.
     */
    basalprofile: BasalTimeslot.array(),

    /**
     * The carb ratio to use if only a single value is to be used.
     */
    carb_ratio: "number",

    /**
     * The Duration of Insulin Activity.
     */
    dia: "number.integer > 0",

    /**
     * The minimum carb absorption in grams, per 5 minutes.
     */
    min_5m_carbimpact: "number.integer > 0",

    /**
     * The type of insulin, indicating how fast the insulin acts and decays.
     */
    curve: InsulinType,

    /**
     * The output units.
     */
    out_units: InsulineUnit,

    /**
     * The native time zone name, e.g. `Europe/Amsterdam`.
     */
    timezone: "string",

    /**
     * The blood glucose target time slots.
     */
    bg_targets: {
        units: InsulineUnit,
        user_preferred_units: InsulineUnit,
        targets: BgTimeslot.array(),
    },

    carb_ratios: {
        first: "number.integer > 0",

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
        first: "number.integer > 0",

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
    autosens_min: "number > 0",

    /**
     * The highest autosens factor.
     */
    autosens_max: "number > 0",

    /**
     * The name of the Nightscout profile.
     */
    profile_name: "string",

    /**
     * The minimum cab absorption per 5 minutes, in grams.
     */
    min_5m_carbimpact: "number.integer > 0",
    
    /**
     * The minimum step of basal units the pump can handle.
     */
    pump_basal_increment: "number",

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