import logger from '@/logger.js'

/**
 * Ensure the required env vars are present.
 * 
 * @param required The required environment variable names
 */
export function exitIfMissing(required: Array<string>) {
    const missing = required.filter(v => !process.env[v])

    if (missing.length > 0) {
        logger.error('Aborting due to missing mandatory environment variable(s) below. Check your .env file.')
        missing.forEach(v => logger.error(`- ${v}`))
        
        process.exit(1)
    }
}