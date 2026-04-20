import { NightscoutApi, NightscoutApiVersion } from '@models/nightscout.js'
import { NightscoutApiV1 } from '@dao/nightscout/v1.js'
import { NightscoutApiV3 } from '@dao/nightscout/v3.js'

const INSTANCES: Map<number, NightscoutApi> = new Map()

/**
 * Factory class for `NightscoutApi` instances.
 */
export class NightscoutApiFactory {

    private constructor() {}

    /**
     * Get the `NightscoutApi` implementation for the given version.
     * 
     * @param version The API version. Defaults to `NightscoutApiVersion.v1`.
     * @returns The `NightscoutApi` for the given version.
     */
    public static getApi(version: NightscoutApiVersion = NightscoutApiVersion.v1): NightscoutApi {
        if (!INSTANCES.has(version)) {
            INSTANCES.set(version, version === NightscoutApiVersion.v3 
                ? new NightscoutApiV3() 
                : new NightscoutApiV1()
            )
        }

        return INSTANCES.get(version)!
    }
}