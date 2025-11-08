import pino from 'pino';
const LOG_LEVELS = {
    development: 'debug',
    production: 'info',
    test: 'silent',
};
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL ||
    LOG_LEVELS[NODE_ENV] ||
    'info';
const loggerConfig = {
    level: LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level(label) {
            return { level: label };
        },
    },
};
export const logger = pino(loggerConfig);
export { LOG_LEVEL, NODE_ENV };
//# sourceMappingURL=logger.js.map