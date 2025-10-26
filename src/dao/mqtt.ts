import mqtt, { MqttClient } from 'mqtt';
import { AutotuneJob as AutotuneJobModel } from '../models/job.js'

type AutotuneJob = typeof AutotuneJobModel.infer

export type JobId = string

export class MqttDAO {

    /**
     * The MQTT Quality of Service. `2` indicates exactly once.
     */
    private static readonly MQTT_QOS = 2

    /**
     * MQTT protocol version.
     * Using version 5 allows userProperties to be sent along
     * any message.
     */
    private static readonly MQTT_PROTOCOL_VERSION = 5

    private readonly client: MqttClient

    /**
     * The topic to connect to.
     */
    private readonly topic: string

    constructor(url: string, username: string, password: string, topic: string) {
        this.client = mqtt.connect(url, { username: username, password: password, protocolVersion: MqttDAO.MQTT_PROTOCOL_VERSION})
        this.topic = topic
    }

    /**
     * Submit an autotune job to MQTT.
     * 
     * @param id The job identifier. Must be unique for all jobs.
     * @param job The autotune job to submit.
     * @returns A promise of `JobId` on success, otherwise `undefined`.
     */
    async submit(id: JobId, job: AutotuneJob): Promise<boolean> {
        const response = await this.client.publishAsync(this.topic, JSON.stringify(job), {
            qos: MqttDAO.MQTT_QOS,
            properties: {
                userProperties: {
                    'X-Job-Id': id
                }
            }
        })

        return response ? true : false
    }
}