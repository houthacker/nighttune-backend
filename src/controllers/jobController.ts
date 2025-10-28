import { v4 as uuidv4 } from 'uuid'
import { SqliteDao } from '../dao/sqlite.js'
import { AutotuneJob as AutotuneJobT, JobId } from '../models/job.js'

type AutotuneJob = typeof AutotuneJobT.infer

export class JobController {

    private readonly sqlite: SqliteDao

    constructor(sqlite: SqliteDao) {
        this.sqlite = sqlite
    }

    async submit(job: AutotuneJob): Promise<boolean> {
        const id: JobId = uuidv4()

        try {
            this.sqlite.enqueueJob(id, job.nightscout_url, job)
            return true
        } catch (err) {
            console.error(`Error while submitting job: ${err}`)
            return false
        }
    }
}