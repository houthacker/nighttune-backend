import { NightscoutApi } from '../../models/nightscout.js' 
import { NightscoutApiV1 } from './v1.js'

import logger from '../../logger.js'

const getJWT = async (url: URL, token: string): Promise<string> => {
    const tokenRequestUrl = new URL(`/api/v2/authorization/request/${token}`, url)
    const response = await fetch(tokenRequestUrl)

    if (response.ok) {
        const body = await response.json() as { token: string }
        return body.token
    }

    logger.warn(`JTW request failed for url [${url.href}]: returned HTTP status ${response.status}`)
    return Promise.reject<string>(new Error('JWT request failed.'))
}

export class NightscoutApiV3 extends NightscoutApiV1 implements NightscoutApi {

    constructor() {
        super()
    }

    override async verify(url: URL, token?: string): Promise<boolean> {
        const statusUrl = new URL('/api/v3/status', url)
        const response = await fetch(statusUrl, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${await getJWT(url, token!)}`
            }
        })
        return false
    }
}