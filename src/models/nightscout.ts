import { type } from 'arktype'
import { Unit } from './job.js'

export class NoSuchProfileError extends Error {
    public readonly profileName: string

    constructor(profileName: string, message: string, cause?: any) {
        super(message, { cause })

        this.profileName = profileName
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

    timeAsSeconds: "number.integer >= 0",

    value: "number >= 0",

    "minutes?": "number.integer >= 0",

    "start?": "string"
})

export const NightscoutProfile = type({
    dia: "number > 0",

    timezone: "string",

    carbs_hr: "number >= 0",

    delay: "20",

    startDate: "string",

    "units?": Unit,

    carbratio: TimedValue.array(),

    sens: TimedValue.array(),

    basal: TimedValue.array(),

    target_low: TimedValue.array(),

    target_high: TimedValue.array(),
})

export const NightscoutProfileStore  = type({
    _id: "string",

    defaultProfile: "string",

    date: "number.integer > 0",

    created_at: "string",

    startDate: "string",

    app: "string",

    utcOffset: "number.integer",

    identifier: "string",

    "srvModified?": "number.integer",

    srvCreated: "number.integer",

    subject: "string",

    mills: "number.integer",

    units: Unit,

    store: type({"[string]": NightscoutProfile}),
})