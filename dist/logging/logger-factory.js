import { logger as baseLogger } from './logger.js';
export function createServiceLogger(serviceName) {
    return baseLogger.child({
        service: serviceName,
    });
}
export const LogPatterns = {
    methodEntry: (logger, method, params = {}) => {
        logger.debug({ method, params }, `Entering ${method}`);
    },
    methodExit: (logger, method, result) => {
        logger.debug({ method, result }, `Exiting ${method}`);
    },
    methodError: (logger, method, error, context = {}) => {
        logger.error({
            method,
            error: error.message,
            errorName: error.name,
            stack: error.stack,
            ...context,
        }, `Error in ${method}`);
    },
    externalApiCall: (logger, api, endpoint, params = {}) => {
        logger.debug({ api, endpoint, params }, `External API call: ${api}`);
    },
    cacheHit: (logger, method, cacheKey) => {
        logger.debug({ method, cacheKey }, `Cache hit`);
    },
    cacheMiss: (logger, method, cacheKey) => {
        logger.debug({ method, cacheKey }, `Cache miss`);
    },
    dbOperation: (logger, operation, table, params = {}) => {
        logger.debug({ operation, table, params }, `Database operation: ${operation} on ${table}`);
    },
};
export const log = LogPatterns;
//# sourceMappingURL=logger-factory.js.map