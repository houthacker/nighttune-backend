import { format } from 'date-fns'

import { NightscoutProfile, NightscoutProfileStore as NightscoutProfileStoreT, NightscoutProfile as NightscoutProfileT, NoSuchProfileError, ProfileAlreadyExistsError } from '../models/nightscout.js'
import { AutotuneResult, PostProcessType, roundToNext } from './recommendationsParser.js'

type NightscoutProfileStore = typeof NightscoutProfileStoreT.infer
type NightscoutProfile = typeof NightscoutProfileT.infer

export class ProfileService {

    /**
     * Create a new Nightscout profile based on the default profile from the given store. 
     * The newly created profile will be added to the store using key `name`.
     * 
     * A profile having the name of `storeKey` must exist in the store. This profile is then used
     * as a base for the new profile.
     * 
     * This method is part of the use case to create a new profile based on the results of a previous
     * job run. This allows users to basically export their autotune results to a new profile. This profile
     * *must* be activated manually by the user in their app (e.g. Nightscout or AAPS).
     * 
     * @param name The name of the new profile. Must be unique within the profile store.
     * @param profileStore The store to add the profile to. Must be present in the profile store.
     * @param storeKey The name of the profile to use as a basis for the new profile.
     * 
     * @throws `NoSuchProfile` if `storeKey` doesn't exist in `profileStore.store`.
     * @throws `ProfileAlreadyExists` if `name` already exists in `profileStore.store`.
     */
    createProfileFromJobResults(
        name: string, 
        profileStore: NightscoutProfileStore, 
        storeKey: string,
        jobResults: AutotuneResult, 
        applyPostProcessing: PostProcessType | undefined = undefined
    ): NightscoutProfileStore {
        if (!Object.hasOwn(profileStore.store, storeKey)) {
            throw new NoSuchProfileError(storeKey, `Given profile ${storeKey} does not exist in profile store.`)
        } else if (Object.hasOwn(profileStore.store, name)) {
            throw new ProfileAlreadyExistsError(name, `Cannot add profile ${name} since it already exists in the profile store.`)
        }

        const newProfile = {...profileStore.store[storeKey]} as NightscoutProfile
        const basalIncrement = jobResults.options!.basalIncrement

        // CR
        const cr = jobResults.find_cr()
        newProfile.carbratio = [{
            time: "00:00",
            timeAsSeconds: 0,
            value: roundToNext(cr.recommendedValue, basalIncrement)
        }]

        // ISF
        const isf = jobResults.find_isf()
        newProfile.sens = [{
            time: "00:00",
            timeAsSeconds: 0,
            value: roundToNext(isf.recommendedValue, basalIncrement)
        }]

        // Basal
        const basal = jobResults.find_basal()
        newProfile.basal = basal.map((b)=> {
            const when = b.when

            // Return either smoothed- or regular recommendations based on parameters,
            // rounded to the next basal increment.
            const basalValue = () => {
                if (applyPostProcessing === PostProcessType.SMOOTH) {
                    return roundToNext(b.smoothedRecommendation() ?? b.recommendedValue, basalIncrement)
                }

                return roundToNext(b.recommendedValue, basalIncrement)
            }

            return {
                time: format(when, 'HH:mm'),
                timeAsSeconds: when.getHours() * 3600 + when.getMinutes() * 60 + when.getSeconds(),
                value: basalValue(),
            }
        })

        // Copy current store and add profile to it.
        const newStore = {...profileStore} as NightscoutProfileStore
        newStore.store[name] = newProfile

        return newStore
    }
}