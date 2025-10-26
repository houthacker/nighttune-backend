import { subtle } from 'node:crypto'


const hash_access_token = async (token: string): Promise<string> => {
    const encoder = new TextEncoder()
    const encoded_token = encoder.encode(token)
    const hash_buffer = await subtle.digest('SHA-1', encoded_token)
    return Array.from(new Uint8Array(hash_buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
}

export class NightscoutDao {

    /**
     * Verifies whether the Nightscout API can be accessed using the given url and optional token.
     * 
     * @param url The Nightscout base url.
     * @param token The access token, required if the Nightscout instance is locked down.
     * @returns Whether the Nightscout API could be accessed.
     */
    async verify(url: string, token?: string): Promise<boolean> {
        const statusUrl = new URL('/api/v1/status.json', url)

        if (token) {
            statusUrl.searchParams.append('token', await hash_access_token(token))
        }

        try {
            const response = await fetch(statusUrl)
            
            if (response.ok) {
                return true
            }

            console.error(`Nightscout API verification failed. HTTP ${response.status}: ${response.statusText}`)
        } catch (error) {
            console.error('Nightscout API verification failed: ', error)
        }
        
        return false;
    }
}