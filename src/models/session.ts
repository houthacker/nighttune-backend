
export interface SessionData {

    /**
     * Whether the user has passed the turnstile test.
     */
    turnstileTestPassed: boolean

    /**
     * The nightscout url
     */
    verifiedNightscoutUrl: string | undefined

    /**
     * The optional nightscout access token
     */
    verifiedNightscoutToken: string | undefined
};

export const defaultSession: SessionData = {
    turnstileTestPassed: false,
    verifiedNightscoutUrl: undefined,
    verifiedNightscoutToken: undefined,
};