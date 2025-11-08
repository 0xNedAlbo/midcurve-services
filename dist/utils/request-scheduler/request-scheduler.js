import { createServiceLogger, log } from '../../logging/index.js';
export class RequestScheduler {
    chain = Promise.resolve();
    lastExecutionTime = 0;
    minSpacingMs;
    name;
    logger;
    constructor(options) {
        if (typeof options === 'number') {
            this.minSpacingMs = options;
            this.name = 'RequestScheduler';
        }
        else {
            this.minSpacingMs = options.minSpacingMs;
            this.name = options.name || 'RequestScheduler';
        }
        this.logger = createServiceLogger(this.name);
        this.logger.info({ minSpacingMs: this.minSpacingMs }, 'RequestScheduler initialized');
    }
    schedule(task) {
        const taskPromise = new Promise((resolve, reject) => {
            this.chain = this.chain
                .then(async () => {
                const now = Date.now();
                const timeSinceLastExecution = now - this.lastExecutionTime;
                const waitTime = Math.max(0, this.minSpacingMs - timeSinceLastExecution);
                if (waitTime > 0) {
                    this.logger.debug({ waitMs: waitTime, timeSinceLastMs: timeSinceLastExecution }, 'Waiting before executing request');
                    await this.sleep(waitTime);
                }
                try {
                    log.methodEntry(this.logger, 'schedule', {
                        waitedMs: waitTime,
                    });
                    const result = await task();
                    log.methodExit(this.logger, 'schedule', {
                        success: true,
                    });
                    resolve(result);
                }
                catch (error) {
                    log.methodError(this.logger, 'schedule', error);
                    reject(error);
                }
                finally {
                    this.lastExecutionTime = Date.now();
                }
            })
                .catch((error) => {
                reject(error);
            });
        });
        return taskPromise;
    }
    getQueueDepth() {
        return 0;
    }
    getTimeUntilNextExecution() {
        const now = Date.now();
        const timeSinceLastExecution = now - this.lastExecutionTime;
        return Math.max(0, this.minSpacingMs - timeSinceLastExecution);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    getStats() {
        return {
            minSpacingMs: this.minSpacingMs,
            lastExecutionTime: this.lastExecutionTime,
            timeUntilNextExecution: this.getTimeUntilNextExecution(),
        };
    }
}
//# sourceMappingURL=request-scheduler.js.map