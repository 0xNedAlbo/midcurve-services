import pino from 'pino';
export interface ServiceLogger extends pino.Logger {
}
export declare function createServiceLogger(serviceName: string): ServiceLogger;
export declare const LogPatterns: {
    methodEntry: (logger: ServiceLogger, method: string, params?: Record<string, unknown>) => void;
    methodExit: (logger: ServiceLogger, method: string, result?: Record<string, unknown>) => void;
    methodError: (logger: ServiceLogger, method: string, error: Error, context?: Record<string, unknown>) => void;
    externalApiCall: (logger: ServiceLogger, api: string, endpoint: string, params?: Record<string, unknown>) => void;
    cacheHit: (logger: ServiceLogger, method: string, cacheKey?: string) => void;
    cacheMiss: (logger: ServiceLogger, method: string, cacheKey?: string) => void;
    dbOperation: (logger: ServiceLogger, operation: string, table: string, params?: Record<string, unknown>) => void;
};
export declare const log: {
    methodEntry: (logger: ServiceLogger, method: string, params?: Record<string, unknown>) => void;
    methodExit: (logger: ServiceLogger, method: string, result?: Record<string, unknown>) => void;
    methodError: (logger: ServiceLogger, method: string, error: Error, context?: Record<string, unknown>) => void;
    externalApiCall: (logger: ServiceLogger, api: string, endpoint: string, params?: Record<string, unknown>) => void;
    cacheHit: (logger: ServiceLogger, method: string, cacheKey?: string) => void;
    cacheMiss: (logger: ServiceLogger, method: string, cacheKey?: string) => void;
    dbOperation: (logger: ServiceLogger, operation: string, table: string, params?: Record<string, unknown>) => void;
};
//# sourceMappingURL=logger-factory.d.ts.map