import { type } from 'arktype'

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { TimedValue } from '../../src/models/nightscout.js'

const parse = (obj: any): typeof TimedValue.infer => {
    return TimedValue(obj) as typeof TimedValue.infer
}

test('TimedValue', (_) => {

    assert.equal(parse({
        time: "00:00",
        timeAsSeconds: 0,
    }) instanceof type.errors, true, 'Expect an error while parsing a TimedValue without value')

    assert.equal(parse({
        time: "00:00",
        timeAsSeconds: 0,
        value: -0.1
    }) instanceof type.errors, true, 'Expect an error while parsing a TimedValue with a negative value')

    assert.equal(parse({
        time: "00:00",
        timeAsSeconds: 0,
        value: "-0.1"
    }) instanceof type.errors, true, 'Expect an error while parsing a TimedValue with a negative value')

    assert.equal(parse({
        time: "00:00",
        timeAsSeconds: 0,
        value: "1.03"
    }).value, 1.03, 'Expect TimedValue.value to be 1.03 when parsed from a string "1.03"')

    assert.equal(parse({
        time: "00:00",
        timeAsSeconds: 0,
        value: 1.03
    }).value, 1.03, 'Expect TimedValue.value to be 1.03 when parsed from a number 1.03')

    assert.equal(parse({
        time: "01:00",
        timeAsSeconds: "3600",
        value: 1.03
    }).timeAsSeconds, 3600, 'Expect TimedValue.timeAsSeconds to be 3600 when parsed from a string "3600"')
})