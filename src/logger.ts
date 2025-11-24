import { inspect } from 'node:util'
import { createLogger, format, transports } from 'winston'

const { colorize, combine, cli, errors, timestamp } = format


const logger = createLogger({
    level: process.env.NT_LOGGER_LOG_LEVEL!,
    format: combine(
        colorize(),
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }), 
        errors({
            stack: true
        }),
        format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`)
    ),
    transports: [new transports.Console()]
})

export default logger