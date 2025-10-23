
export interface SessionData {

    /**
     * Whether the user has passed the turnstile test.
     */
    turnstileTestPassed: boolean;
};

export const defaultSession: SessionData = {
    turnstileTestPassed: false,
};