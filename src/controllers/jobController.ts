import { v4 as uuidv4 } from 'uuid'
import { MqttDAO } from '../dao/mqtt.js'
import { SqliteDao } from '../dao/sqlite.js'
import { AutotuneJob as AutotuneJobT } from '../models/job.js'

import type { JobId } from '../dao/mqtt.js'

type AutotuneJob = typeof AutotuneJobT.infer

export class JobController {

    private readonly mqtt: MqttDAO

    private readonly sqlite: SqliteDao

    constructor(mqtt: MqttDAO, sqlite: SqliteDao) {
        this.mqtt = mqtt
        this.sqlite = sqlite
    }

    async submit(job: AutotuneJob): Promise<boolean> {
        const id: JobId = uuidv4()

        try {
            this.sqlite.enqueueJob(id, job.nightscout_url, job)
            return await this.mqtt.submit(id, job);
        } catch (err) {
            console.error(`Error while submitting job: ${err}`)
            return false;
        }
    }
}