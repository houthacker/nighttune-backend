import { AutotuneResult } from 'src/services/recommendationsParser.js'
import { FailedJob, JobMeta } from './job.js'

export class GDPRUserData {

    readonly jobs: Array<JobMeta>

    readonly job_results: Array<AutotuneResult>

    readonly failed_jobs: Array<FailedJob>

    constructor(jobs: Array<JobMeta>, job_results: Array<AutotuneResult>, failed_jobs: Array<FailedJob>) {
        this.jobs = jobs
        this.job_results = job_results
        this.failed_jobs = failed_jobs
    }
}