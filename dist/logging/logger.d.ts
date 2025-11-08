import pino from 'pino';
declare const NODE_ENV: string;
declare const LOG_LEVEL: string;
export declare const logger: pino.Logger<never, boolean>;
export type Logger = typeof logger;
export { LOG_LEVEL, NODE_ENV };
//# sourceMappingURL=logger.d.ts.map