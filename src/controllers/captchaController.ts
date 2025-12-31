
import fetch from 'node-fetch'

import logger from '../logger.js'

export interface CaptchaValidation {
    success: boolean,
}

export async function validateCaptcha(token: string, remote_ip: string): Promise<CaptchaValidation> {
    try {
        const response = await fetch(new URL(`https://captcha.nighttune.app/${encodeURIComponent(process.env.NT_CAPTCHA_SITEKEY!)}/siteverify`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': remote_ip,
            },
            body: JSON.stringify({
                secret: process.env.NT_CAPTCHA_SECRET!,
                response: token
            })
        })

        return await response.json() as CaptchaValidation
    } catch (error) {
        logger.error('Captcha validation error: ', error)
        return { success: false } as CaptchaValidation
    }
}