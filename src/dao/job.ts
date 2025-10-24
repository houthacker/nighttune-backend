import mqtt, { MqttClient } from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import { AutotuneJob as AutotuneJobModel } from '../models/job.js'

type AutotuneJob = typeof AutotuneJobModel.infer

export type JobId = string

export class JobMqttDAO {

    // Exactly once delivery
    private static readonly MQTT_QOS = 2

    private readonly client: MqttClient

    private readonly topic: string

    constructor(url: string, username: string, password: string, topic: string) {
        this.client = mqtt.connect(url, { username: username, password: password})

        this.topic = topic
    }

    /**
     * Submit an autotune job to MQTT.
     * 
     * @param job The autotune job to submit.
     * @returns A promise of `JobId` on success, otherwise `undefined`.
     */
    async submit(job: AutotuneJob): Promise<JobId | undefined> {
        const jobId: JobId = uuidv4()

        const response = await this.client.publishAsync(this.topic, JSON.stringify(job), {
            qos: JobMqttDAO.MQTT_QOS,
            properties: {
                userProperties: {
                    'X-Job-Id': jobId
                }
            }
        })

        return response ? jobId : undefined
    }
}