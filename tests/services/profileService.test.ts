import { parseJSON } from 'date-fns'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { Assert, AssertStrict }  from 'node:assert'

import { NightscoutProfileStore } from '../../src/models/nightscout.js'
import { AutotuneJob as AutotuneJobT } from '../../src/models/job.js'
import { AutotuneOptions, AutotuneResult, Recommendation } from '../../src/services/recommendationsParser.js'
import { ProfileService } from '../../src/services/profileService.js'

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
    const expectedProfile = NightscoutProfileStore(jsonFixture('new_profile_no_post_processing.json'))
    const profilesFromNightscout = NightscoutProfileStore((jsonFixture('api_v1_profile.json') as any[])[0]) as typeof NightscoutProfileStore.infer
    const parameters = AutotuneJobT(jsonFixture('job_parameters.json')) as typeof AutotuneJobT.infer
    const {options, recommendations} = jsonFixture('job_results.json') as {options: AutotuneOptions | undefined, recommendations: Recommendation[]}
    const profile = service.createProfileFromJobResults("Autotune", profilesFromNightscout, parameters.settings.profile_name, new AutotuneResult(recommendations, options))

    const assert: AssertStrict = new Assert({ diff: 'full' })
    assert.deepEqual(profile, expectedProfile)
})