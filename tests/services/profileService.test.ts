import { parseJSON } from 'date-fns'
import { Assert, AssertStrict } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { AutotuneJob as AutotuneJobT } from '../../src/models/job.js'
import { NightscoutProfileStore } from '../../src/models/nightscout.js'
import { ProfileService } from '../../src/services/profileService.js'
import { AutotuneOptions, AutotuneResult, Recommendation, roundToNext } from '../../src/services/recommendationsParser.js'

const service = new ProfileService()

const jsonFixture = (name: string): any => {
    return JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(`${import.meta.dirname}/../resources/${name}`)), 'utf8'), (key: string, value: any): any => {
        if (key === 'when') {
            return parseJSON(value)
        }

        return value
    })
}

test('Create a new profile from job results', (_) => {
    const profileName = "Autotune"
    const profilesFromNightscout = NightscoutProfileStore((jsonFixture('api_v1_profile.json') as any[])[0]) as typeof NightscoutProfileStore.infer
    const parameters = AutotuneJobT(jsonFixture('job_parameters.json')) as typeof AutotuneJobT.infer
    const {options, recommendations} = jsonFixture('job_results.json') as {options: AutotuneOptions | undefined, recommendations: Recommendation[]}
    const results = new AutotuneResult(recommendations, options)
    const profile = service.createProfileFromJobResults(profileName, profilesFromNightscout, parameters.settings.profile_name, results)

    const assert: AssertStrict = new Assert({ diff: 'full' })
    assert.equal(profile.defaultProfile, profileName)
    assert.equal(Object.hasOwn(profile.store, profileName), true)
    assert.equal(Object.hasOwn(profilesFromNightscout.store, profileName), false)
    assert.notEqual(profile.startDate, profilesFromNightscout.startDate)
    assert.notEqual(profile.created_at, profilesFromNightscout.created_at)

    const createdProfile = profile.store[profileName]
    assert.deepEqual(createdProfile.carbratio, [{
        time: '00:00',
        timeAsSeconds: 0,
        value: roundToNext(results.find_cr().recommendedValue, results.options!.basalIncrement),
    }])
    assert.deepEqual(createdProfile.sens, [{
        time: '00:00',
        timeAsSeconds: 0,
        value: roundToNext(results.find_isf().recommendedValue, results.options!.basalIncrement),
    }])
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(profile)))
})