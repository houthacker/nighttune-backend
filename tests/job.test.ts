import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type } from 'arktype'

import { test } from 'node:test'
import assert from 'node:assert'

import { AutotuneJob, POST_PROCESSING_REVIVER } from '../src/models/job.js'

const jsonFixture = (name: string): any => {
    return JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(`${import.meta.dirname}/resources/${name}`)), 'utf8'))
}

test('validate a job request', (t) => {
    const request = AutotuneJob(jsonFixture('job_request.json'))
    assert(!(request instanceof type.errors), 'Job request must be an instance of typeof AutotuneJob.infer')
})

test('validate', (t) => {
    const request = AutotuneJob(jsonFixture('job_request_mg_dl_case.json'))
    assert(!(request instanceof type.errors), 'Expect mg/dL to be a valid profile unit')
})

test('dia accepts decimal numbers', (t) => {
    const request = AutotuneJob(jsonFixture('job_request_dia_decimal.json'))
    assert(!(request instanceof type.errors), 'Expect 8.75 to be a valid DIA')
})

test('revive from null values', (t) => {
    assert.doesNotThrow(() => {
        const str = JSON.stringify({field: null})
        JSON.parse(str, POST_PROCESSING_REVIVER)
    })
})

test('revive from non-array post processing values', (t) => {
    assert.doesNotThrow(() => {
        const str = JSON.stringify({dt: 'Map', v: 1})
        JSON.parse(str, POST_PROCESSING_REVIVER)
    })
})