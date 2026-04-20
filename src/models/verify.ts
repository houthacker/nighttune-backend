import { type } from 'arktype'
import { NightscoutApiVersion } from '@models/nightscout.js'

// The minimum length of a Nightscout access token (16 + '-' + abbreviated name.)
export const NIGHTSCOUT_TOKEN_MIN_LENGTH: number = 18

export const VerificationRequest = type({

    /**
     * The URL of the nightscout instance to use.
     */
    nightscout_url: "string.url",

    /**
     * The optional access token required to access the Nightscout instance.
     */
    "nightscout_access_token?": "string",

    /**
     * The Nightscout API version to use. Defaults to v1.
     */
    nightscout_api_version: [type.valueOf(NightscoutApiVersion), "=", NightscoutApiVersion.v1]
})