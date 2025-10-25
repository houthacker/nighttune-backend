import { MqttDAO } from '../dao/mqtt.js'
import { AutotuneJob as AutotuneJobT } from '../models/job.js'

import type { JobId } from '../dao/mqtt.js'

type AutotuneJob = typeof AutotuneJobT.infer

export class JobController {

    private readonly mqtt: MqttDAO

    constructor(mqttDao: MqttDAO) {
        this.mqtt = mqttDao
    }

    async submit(job: AutotuneJob): Promise<JobId | undefined> {
        // TODO store state in db
        return await this.mqtt.submit(job)
    }
}