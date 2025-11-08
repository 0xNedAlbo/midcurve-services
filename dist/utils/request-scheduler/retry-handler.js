import { createServiceLogger, log } from '../../logging/index.js';
function defaultIsRetryable(status) {
    if (status === 429)
        return true;
    if (status >= 500 && status < 600)
        return true;
    return false;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function withRetries(call, options = {}) {
    const { retries = 6, baseDelayMs = 800, maxDelayMs = 8000, name = 'RetryHandler', isRetryable = defaultIsRetryable, } = options;
    const logger = createServiceLogger(name);
    let attempt = 0;
    while (true) {
        let response;
        try {
            log.methodEntry(logger, 'withRetries', { attempt, maxRetries: retries });
            response = await call();
        }
        catch (error) {
            log.methodError(logger, 'withRetries', error, { attempt });
            if (attempt >= retries) {
                logger.error({ attempt, maxRetries: retries, error }, 'All retry attempts exhausted for network error');
                throw error;
            }
            const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
            const jitter = Math.floor(Math.random() * 200);
            const totalDelay = delay + jitter;
            logger.warn({ attempt, delay: totalDelay, error }, 'Network error, retrying with backoff');
            await sleep(totalDelay);
            attempt++;
            continue;
        }
        if (response.ok) {
            log.methodExit(logger, 'withRetries', { attempt, status: response.status });
            return response.json();
        }
        const status = response.status;
        const bodyText = await response.text().catch(() => '');
        const shouldRetry = isRetryable(status);
        if (!shouldRetry || attempt >= retries) {
            const error = new Error(`HTTP ${status} ${response.statusText}${bodyText ? `: ${bodyText}` : ''}`);
            log.methodError(logger, 'withRetries', error, {
                attempt,
                status,
                retryable: shouldRetry,
            });
            if (attempt >= retries) {
                logger.error({ attempt, maxRetries: retries, status, bodyText }, 'All retry attempts exhausted');
            }
            else {
                logger.error({ attempt, status, bodyText }, 'Non-retryable error, not retrying');
            }
            throw error;
        }
        const retryAfterHeader = response.headers.get('Retry-After');
        let delay;
        if (retryAfterHeader) {
            const retryAfterSeconds = Number(retryAfterHeader);
            if (!isNaN(retryAfterSeconds)) {
                delay = Math.min(maxDelayMs, Math.max(baseDelayMs, retryAfterSeconds * 1000));
                logger.info({ retryAfterSeconds, calculatedDelayMs: delay }, 'Using Retry-After header for delay');
            }
            else {
                const retryAfterDate = new Date(retryAfterHeader);
                const retryAfterMs = retryAfterDate.getTime() - Date.now();
                delay = Math.min(maxDelayMs, Math.max(baseDelayMs, retryAfterMs));
                logger.info({ retryAfterDate, calculatedDelayMs: delay }, 'Using Retry-After date for delay');
            }
        }
        else {
            delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
        }
        const jitter = Math.floor(Math.random() * 200);
        const totalDelay = delay + jitter;
        logger.warn({
            attempt: attempt + 1,
            maxRetries: retries,
            status,
            delay: totalDelay,
            hasRetryAfter: !!retryAfterHeader,
        }, 'Retryable error, backing off');
        await sleep(totalDelay);
        attempt++;
    }
}
export class ApiError extends Error {
    statusCode;
    response;
    constructor(message, statusCode, response) {
        super(message);
        this.statusCode = statusCode;
        this.response = response;
        this.name = 'ApiError';
    }
}
export async function withRetriesApiError(call, options = {}) {
    try {
        return await withRetries(call, options);
    }
    catch (error) {
        if (error instanceof Error) {
            const statusMatch = error.message.match(/HTTP (\d+)/);
            const statusCode = statusMatch ? Number(statusMatch[1]) : undefined;
            throw new ApiError(error.message, statusCode);
        }
        throw error;
    }
}
//# sourceMappingURL=retry-handler.js.map