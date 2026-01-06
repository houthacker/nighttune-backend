import { AutotuneErrorType, FailedJob } from '../../src/models/job.js'
import { createInMemoryDatabase } from '../util/sqlite.js'

import assert from 'node:assert/strict'
import { test } from 'node:test'

test('Get GDPR user data', (t) => {
    const dao = createInMemoryDatabase('gdpr_data_export.sql')
    const data = dao.userData(new URL('https://nightscout-site-one.test'))

    assert.equal(data.jobs.length, 10)
    assert.deepEqual(data.failed_jobs, [
        new FailedJob('107977a9-ef66-4fca-9fbd-87e01ead029a', AutotuneErrorType.AutotuneFailed),
    ])
})

test('Delete all GDPR user data', (t) => {
    const url = new URL('https://nightscout-site-one.test')
    const dao = createInMemoryDatabase('gdpr_data_export.sql')

    const data = dao.userData(url)
    assert.equal(data.jobs.length, 10)
    assert.equal(data.failed_jobs.length, 1)
    assert.equal(data.job_results.length, 9)

    const deletedData = dao.deleteAll(url)
    assert.deepEqual(data, deletedData, 'Expect all user data to be deleted')

    // After deleting all user data, no data about the Nightscout URL is allowed to exist
    // in the database.
    const leftovers = dao.userData(url)
    assert.equal(leftovers.jobs.length, 0)
    assert.equal(leftovers.failed_jobs.length, 0)
    assert.equal(leftovers.job_results.length, 0)
})