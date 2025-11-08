export interface RetryOptions {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    name?: string;
    isRetryable?: (status: number) => boolean;
}
export declare function withRetries<T>(call: () => Promise<Response>, options?: RetryOptions): Promise<T>;
export declare class ApiError extends Error {
    readonly statusCode?: number | undefined;
    readonly response?: Response | undefined;
    constructor(message: string, statusCode?: number | undefined, response?: Response | undefined);
}
export declare function withRetriesApiError<T>(call: () => Promise<Response>, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=retry-handler.d.ts.map