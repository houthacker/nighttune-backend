import { NightscoutApi } from '../../models/nightscout.js'
import { NightscoutApiV1 } from './v1.js'

import { jwtDecode, JwtPayload } from 'jwt-decode'

import { HeadersInit } from 'node-fetch'
import logger from '../../logger.js'

type NightscoutAccessToken = string

class JWT {

    private readonly decoded: JwtPayload & {
        accessToken: string
    }

    public readonly raw

    constructor(jwt: string) {
        this.decoded = jwtDecode(jwt)
        this.raw = jwt
    }

    static async acquire(url: URL, accessToken: NightscoutAccessToken): Promise<JWT> {
        const tokenRequestUrl = new URL(`/api/v2/authorization/request/${accessToken}`, url)
        const response = await fetch(tokenRequestUrl)

        if (response.ok) {
            const body = await response.json() as { token: string }
            return new JWT(body.token)
        }

        logger.warn(`Failed to get JTW for url [${url.href}]: returned HTTP status ${response.status}`)
        return Promise.reject<JWT>(new Error('JWT request failed.'))
    }

    accessToken(): NightscoutAccessToken {
        return this.decoded.accessToken
    }

    /**
     * Returns whether this `JWT` is valid, optionally using the given
     * safety margin. This allows checking if for example this token is
     * valid for at least the next `x` seconds.
     * 
     * @param margin The margin in seconds to subtract from the actual expiry time. Defaults to 5 seconds.
     */
    isValid(margin: number = 5): boolean {
        const now = Math.floor(Date.now() / 1000)
        return this.decoded.exp! - Math.floor(margin) > now
    }
}

export class NightscoutApiV3 extends NightscoutApiV1 implements NightscoutApi {

    /**
     * A cache of JTW tokens, indexed by their URL and Access Token.
     */
    private tokenCache: Map<{url: string, token: NightscoutAccessToken}, JWT>

    constructor() {
        super()

        this.tokenCache = new Map()
    }

    private async acquireValidToken(url: URL, accessToken: NightscoutAccessToken): Promise<JWT> {
        let jwt = this.tokenCache.get({url: url.href, token: accessToken})
        if (jwt && jwt.isValid()) {
            return jwt
        }

        jwt = await JWT.acquire(url, accessToken)
        this.tokenCache.set({url: url.href, token: accessToken}, jwt)

        return jwt
    }

    override async verify(url: URL, token?: NightscoutAccessToken): Promise<boolean> {
        const statusUrl = new URL('/api/v3/status', url)
        const headers: HeadersInit = {
            'Accept': 'application/json',
        }

        try {
            if (token) {
                const jwt = await this.acquireValidToken(url, token!)
                headers['Authorization'] = `Bearer ${jwt.raw}`
            }

            const response = await fetch(statusUrl, { headers })
            if (response.ok) {
                return true
            }

            logger.warn(`Verification of Nightscout API at '${url.href}' failed: HTTP ${response.status} (${response.statusText}) `)
            return false
        } catch (error: any) {
            logger.error(`Verification of Nightscout API at '${url.href}' failed: \n${JSON.stringify(error)}`)
        }

        return false
    }
}