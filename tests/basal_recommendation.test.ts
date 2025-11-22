import { test } from 'node:test'
import assert from 'node:assert'

import { BasalRecommendation } from '../src/services/recommendationsParser.js'

test('Basal recommendation is rounded to pump basal increment', (t) => {
    const r0_01_044 = new BasalRecommendation(new Date(), 0.3, 0.44, 0, 0.01)
    assert(r0_01_044.roundedRecommendation === r0_01_044.recommendedValue, 'Expect rounded basal recommendation of 0.44 to equal 0.44 if pump increment is 0.01')

    const r0_05_044 = new BasalRecommendation(new Date(), 0.3, 0.44, 0, 0.05)
    assert(r0_05_044.roundedRecommendation === 0.45, 'Expect rounded basal recommendation of 0.44 to equal 0.45 if pump increment is 0.05')

    const r0_1_044 = new BasalRecommendation(new Date(), 0.3, 0.44, 0, 0.1)
    assert(r0_1_044.roundedRecommendation === 0.4, 'Expect rounded basal recommendation of 0.44 to equal 0.4 if pump increment is 0.1')

    const r0_5_044 = new BasalRecommendation(new Date(), 0.3, 0.44, 0, 0.5)
    assert(r0_5_044.roundedRecommendation === 0.5, 'Expect rounded basal recommendation of 0.44 to equal 0.5 if pump increment is 0.5')

    const r1_045 = new BasalRecommendation(new Date(), 0.3, 0.45, 0, 1.0)
    assert(r1_045.roundedRecommendation === 0.0, 'Expect rounded basal recommendation of 0.45 to equal 0.0 if pump increment is 1.0')

    const r1_055 = new BasalRecommendation(new Date(), 0.3, 0.55, 0, 1.0)
    assert(r1_055.roundedRecommendation === 1.0, 'Expect rounded basal recommendation of 0.55 to equal 1.0 if pump increment is 1.0')
})