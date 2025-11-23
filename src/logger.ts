import { createLogger, format, transports } from 'winston'

const { combine, timestamp, cli } = format

const logger = createLogger({
    level: process.env.NT_LOGGER_LOG_LEVEL!,
    format: combine(timestamp(), cli()),
    transports: [new transports.Console()]
})

export default logger