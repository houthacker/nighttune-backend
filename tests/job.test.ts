import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type } from 'arktype'

import { test } from 'node:test'
import assert from 'node:assert'

import { AutotuneJob } from '../src/models/job.js'

const jsonFixture = (name: string): any => {
    return JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(`${import.meta.dirname}/resources/${name}`)), 'utf8'))
}

test('validate a job request', (t) => {
    const request = AutotuneJob(jsonFixture('job_request.json'))
    assert(!(request instanceof type.errors), 'Job request must be an instance of typeof AutotuneJob.infer')
})

test('validate', (t) => {
    const request = AutotuneJob(jsonFixture('job_request_mg_dl_case.json'))
    assert(!(request instanceof type.errors), 'Job request must be an instance of typeof AutotuneJob.infer')
})