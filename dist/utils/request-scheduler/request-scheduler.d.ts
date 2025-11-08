export interface RequestSchedulerOptions {
    minSpacingMs: number;
    name?: string;
}
export declare class RequestScheduler {
    private chain;
    private lastExecutionTime;
    private readonly minSpacingMs;
    private readonly name;
    private readonly logger;
    constructor(options: RequestSchedulerOptions | number);
    schedule<T>(task: () => Promise<T>): Promise<T>;
    getQueueDepth(): number;
    getTimeUntilNextExecution(): number;
    private sleep;
    getStats(): {
        minSpacingMs: number;
        lastExecutionTime: number;
        timeUntilNextExecution: number;
    };
}
//# sourceMappingURL=request-scheduler.d.ts.map