
export interface SessionData {

    /**
     * Whether the user has passed the turnstile test.
     */
    turnstileTestPassed: boolean

    /**
     * The nightscout url
     */
    verifiedNightscoutUrl: string | undefined
};

export const defaultSession: SessionData = {
    turnstileTestPassed: false,
    verifiedNightscoutUrl: undefined,
};