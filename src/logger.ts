import { createLogger, format, transports } from 'winston'

const { colorize, combine, errors, json, timestamp } = format

const logger = createLogger({
    level: process.env.NT_LOGGER_LOG_LEVEL!,
    format: combine(
        json(),
        colorize(),
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss Z'
        }), 
        errors({
            stack: true
        }),
    ),
    transports: [new transports.Console({
        format: format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`)
    })]
})

export default logger