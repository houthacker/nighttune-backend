import { tz } from '@date-fns/tz'
import { format, parseISO } from 'date-fns'
import ejs from 'ejs'
import Mailjet from 'node-mailjet'
import { fileURLToPath } from 'node:url'

import logger from '../logger.js'
import { AutotuneResult } from '../services/recommendationsParser.js'

export interface MailDao {
    sendReport(recipient: string, report: AutotuneResult): Promise<boolean>;
}

export class MailjetDao implements MailDao {
    private readonly api: Mailjet.Client

    constructor() {
        this.api = Mailjet.Client.apiConnect(
            process.env.NT_MAIL_APIKEY_PUBLIC!, 
            process.env.NT_MAIL_APIKEY_PRIVATE!
        )
    }

    async sendReport(recipient: string, report: AutotuneResult): Promise<boolean> {
        try {
            const path = fileURLToPath(import.meta.resolve(import.meta.dirname + '/../templates/email_report.ejs'))
            const html = await ejs.renderFile(path, {
                result: report,
                isf: report.find_isf(),
                cr: report.find_cr(),
                basal: report.find_basal(),
                formatDateString: (value: string): string => {
                    return format(parseISO(value), 'yyyy-MM-dd', {
                        in: tz(report.options.timeZone)
                    })
                },
                formatTime: (date: Date): string => {
                    return format(date, 'HH:mm', {
                        in: tz(report.options.timeZone)
                    })
                }
            })

            await this.api.post('send', { version: 'v3.1' }).request({
                Messages: [{
                    From: {
                        Email: process.env.NT_MAIL_SENDER_ADDRESS!,
                        Name: process.env.NT_MAIL_SENDER_NAME!
                    },
                    To: [{
                        Email: recipient
                    }],
                    Subject: 'Autotune results',
                    HTMLPart: html
                }]
            })
            return true
        } catch (error: any) {
            logger.error(`Failed to send autotune report to [${recipient}]: `, error)
        }

        return false
    }

}
