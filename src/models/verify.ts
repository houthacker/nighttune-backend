import { type } from 'arktype';

export const VerificationRequest = type({

    /**
     * The URL of the nightscout instance to use.
     */
    nightscout_url: "string.url",

    /**
     * The optional access token required to access the Nightscout instance.
     */
    "nightscout_access_token?": "string",
})