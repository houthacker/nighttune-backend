import { createLogger, format, transports } from 'winston'

const { colorize, combine, errors, timestamp } = format

const logger = createLogger({
    level: process.env.NT_LOGGER_LOG_LEVEL ?? 'info',
    format: combine(
        colorize(),
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss Z'
        }), 
        errors({
            cause: true,
            stack: true
        }),
    ),
    transports: [new transports.Console({
        format: format.printf(info => {
            let message = `${info.timestamp} [${info.level}]: ${info.message}`

            if (info.stack) {
                message += ` ${info.stack}`
            }

            if (info.cause) {
                const c = info.cause as any
                message += `\nCaused by ${c.stack}`
            }
            return message
        })
    })]
})

export default logger