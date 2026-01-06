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