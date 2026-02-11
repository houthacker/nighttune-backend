import { NightscoutApiVersion } from './nightscout.js'

export interface SessionData {

    /**
     * Whether the user has passed the captcha test.
     */
    captchaTestPassed: boolean

    /**
     * The nightscout url
     */
    verifiedNightscoutUrl: string | undefined

    /**
     * The optional nightscout access token
     */
    verifiedNightscoutToken: string | undefined

    /**
     * The Nightscout API version to use
     */
    nightscoutApiVersion: NightscoutApiVersion
}

export const defaultSession: SessionData = {
    captchaTestPassed: false,
    verifiedNightscoutUrl: undefined,
    verifiedNightscoutToken: undefined,
    nightscoutApiVersion: NightscoutApiVersion.v1
}