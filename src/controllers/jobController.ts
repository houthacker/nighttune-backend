import { JobMqttDAO } from '../dao/job.js'
import { AutotuneJob as AutotuneJobT } from '../models/job.js'

import type { JobId } from '../dao/job.js'

type AutotuneJob = typeof AutotuneJobT.infer

export class JobController {

    private readonly mqtt: JobMqttDAO

    constructor(mqttDao: JobMqttDAO) {
        this.mqtt = mqttDao
    }

    async submit(job: AutotuneJob): Promise<JobId | undefined> {
        // TODO store state in db
        return await this.mqtt.submit(job)
    }
}