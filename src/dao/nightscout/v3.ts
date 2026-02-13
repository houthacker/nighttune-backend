import { AccessDeniedError, NightscoutApi, NightscoutProfileStore as NightscoutProfileStoreT, NoSuchProfileError, ProfileModificationError, UnauthorizedError } from '../../models/nightscout.js'
import { NightscoutApiV1 } from './v1.js'

import { jwtDecode, JwtPayload } from 'jwt-decode'
import { type } from 'arktype'
import { type HeadersInit } from 'node-fetch'
import logger from '../../logger.js'

type ProfileStore = typeof NightscoutProfileStoreT.infer
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

    private async requiredHeaders(url: URL, token?: NightscoutAccessToken): Promise<HeadersInit> {
        const headers: HeadersInit = {
            'Accept': 'application/json'
        }

        if (token) {
            const jwt = await this.acquireValidToken(url, token!)
            headers['Authorization'] = `Bearer ${jwt.raw}`
        }

        return headers
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

        try {
            const headers = await this.requiredHeaders(url, token)
            const response = await fetch(statusUrl, { headers } as RequestInit)
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

    override async profileStore(url: URL, token?: string): Promise<ProfileStore> {
        const profileStoreUrl = new URL('/api/v3/profile', url)
        profileStoreUrl.searchParams.append('sort$desc', 'srvCreated')
        profileStoreUrl.searchParams.append('limit', '1')
        profileStoreUrl.searchParams.append('skip', '0')
        profileStoreUrl.searchParams.append('fields', '_all')

        try {
            const headers = await this.requiredHeaders(url, token)
            const response = await fetch(profileStoreUrl, { headers } as RequestInit)

            if (response.ok) {
                const body = await response.json() as { status: number, result: any[] }
                const stores = NightscoutProfileStoreT.array()(body.result)

                // Required for backwards compatibility
                // TODO Remove after successfully running without errors for some time.
                if (stores instanceof type.errors) {
                    logger.error(`Falling back to lenient parsing: Cannot strictly parse response body into NightscoutProfileStore[]:\n${stores.summary}`)
                    return Promise.resolve(body.result[0] as ProfileStore)
                }

                return Promise.resolve(stores[0])
            }

            logger.warn(`Failed to fetch user profiles from ${profileStoreUrl.href}: HTTP ${response.status}: ${response.statusText}`)
            return Promise.reject(new Error(`Failed to fetch user profiles: NS instance returned HTTP error status ${response.status}`))
        } catch (error: any) {
            logger.warn(`Error while fethching user profiles from ${profileStoreUrl.href}:\n${JSON.stringify(error)}`)
            return Promise.reject(new Error('Error while fetching user profiles.'))
        }
    }

    override async createProfile(profile: ProfileStore, url: URL, token?: string): Promise<void> {
        const profileUrl = new URL('/api/v3/profile', url)

        try {
            const headers = {
                'Content-Type' : 'application/json',
                ...await this.requiredHeaders(url, token)
            }
            const response = await fetch(profileUrl, {
                method: 'POST',
                body: JSON.stringify(profile),
                headers
            })

            if (response.ok) {
                return Promise.resolve()
            }

            switch(response.status) {
                case 401: throw new UnauthorizedError(url.href)
                case 403: throw new AccessDeniedError(url.href)
                case 422: throw new ProfileModificationError(url.href)
                default:
                    const msg = `Could not add profile to Nightscout site at ${url.href}: HTTP response code was ${response.status}`
                    logger.error(msg)
                    return Promise.reject(new Error(msg))
            }

        } catch (error: any) {
            logger.error(`Creating profile at ${url.href} failed: ${JSON.stringify(error)}`)
            throw error
        }
    }
}