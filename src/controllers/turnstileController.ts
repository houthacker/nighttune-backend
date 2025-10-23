
import fetch from 'node-fetch';

export interface ValidationMeta {
    ephemeral_id: string
};

export interface TurnstileValidation {
    success: boolean,
    challenge_ts: string | undefined,
    hostname: string | undefined,
    'error-codes': Array<string>,
    action: string | undefined,
    cdata: string | undefined,
    metadata: ValidationMeta | undefined
};

export async function validateTurnstile(token: string, remote_ip: string): Promise<TurnstileValidation> {
    const formData = new FormData();
    formData.append('secret', process.env.NT_TURNSTILE_SECRET!);
    formData.append('response', token);
    formData.append('remoteip', remote_ip);

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        return await response.json() as TurnstileValidation;
    } catch (error) {
        console.error('Turnstile validation error:', error);
        return { success: false, 'error-codes': ['internal-error']} as TurnstileValidation;
    }
};