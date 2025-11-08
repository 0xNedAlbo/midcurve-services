import { PrismaClient } from '@prisma/client';
import { calculateAprBps, calculateDurationSeconds, calculateTimeWeightedCostBasis, } from '../../utils/apr/apr-calculations.js';
import { createServiceLogger, log } from '../../logging/index.js';
export class PositionAprService {
    prisma;
    logger;
    constructor(dependencies = {}) {
        this.prisma = dependencies.prisma ?? new PrismaClient();
        this.logger = createServiceLogger('PositionAprService');
        this.logger.info('PositionAprService initialized');
    }
    async calculateAprPeriods(positionId) {
        log.methodEntry(this.logger, 'calculateAprPeriods', { positionId });
        try {
            log.dbOperation(this.logger, 'deleteMany', 'PositionAprPeriod', { positionId });
            await this.prisma.positionAprPeriod.deleteMany({
                where: { positionId },
            });
            log.dbOperation(this.logger, 'findMany', 'PositionLedgerEvent', { positionId });
            const eventsRaw = await this.prisma.positionLedgerEvent.findMany({
                where: { positionId },
                orderBy: { timestamp: 'asc' },
            });
            if (eventsRaw.length === 0) {
                this.logger.info({ positionId }, 'No ledger events found, skipping APR calculation');
                log.methodExit(this.logger, 'calculateAprPeriods', { count: 0 });
                return [];
            }
            const events = eventsRaw.map((e) => this.deserializeEvent(e));
            this.logger.info({ positionId, eventCount: events.length }, 'Fetched ledger events for APR calculation');
            const periods = this.divideEventsIntoPeriods(events);
            this.logger.info({ positionId, periodCount: periods.length }, 'Divided events into APR periods');
            const savedPeriods = [];
            for (const periodEvents of periods) {
                try {
                    const periodInput = this.buildAprPeriodFromEvents(positionId, periodEvents);
                    log.dbOperation(this.logger, 'create', 'PositionAprPeriod', {
                        positionId,
                        startTimestamp: periodInput.startTimestamp,
                        endTimestamp: periodInput.endTimestamp,
                    });
                    const dbResult = await this.prisma.positionAprPeriod.create({
                        data: {
                            positionId: periodInput.positionId,
                            startEventId: periodInput.startEventId,
                            endEventId: periodInput.endEventId,
                            startTimestamp: periodInput.startTimestamp,
                            endTimestamp: periodInput.endTimestamp,
                            durationSeconds: periodInput.durationSeconds,
                            costBasis: periodInput.costBasis.toString(),
                            collectedFeeValue: periodInput.collectedFeeValue.toString(),
                            aprBps: periodInput.aprBps,
                            eventCount: periodInput.eventCount,
                        },
                    });
                    savedPeriods.push(this.deserializePeriod(dbResult));
                    this.logger.debug({
                        positionId,
                        periodId: dbResult.id,
                        aprBps: periodInput.aprBps,
                        durationSeconds: periodInput.durationSeconds,
                    }, 'APR period saved');
                }
                catch (error) {
                    this.logger.warn({
                        positionId,
                        error: error.message,
                    }, 'Failed to create APR period, skipping');
                }
            }
            const sortedPeriods = savedPeriods.sort((a, b) => b.startTimestamp.getTime() - a.startTimestamp.getTime());
            this.logger.info({ positionId, periodCount: sortedPeriods.length }, 'APR calculation completed');
            log.methodExit(this.logger, 'calculateAprPeriods', { count: sortedPeriods.length });
            return sortedPeriods;
        }
        catch (error) {
            log.methodError(this.logger, 'calculateAprPeriods', error, { positionId });
            throw error;
        }
    }
    async refresh(positionId) {
        log.methodEntry(this.logger, 'refresh', { positionId });
        const periods = await this.calculateAprPeriods(positionId);
        log.methodExit(this.logger, 'refresh', { count: periods.length });
        return periods;
    }
    async getAprPeriods(positionId) {
        log.methodEntry(this.logger, 'getAprPeriods', { positionId });
        try {
            log.dbOperation(this.logger, 'findMany', 'PositionAprPeriod', { positionId });
            const periodsRaw = await this.prisma.positionAprPeriod.findMany({
                where: { positionId },
                orderBy: { startTimestamp: 'desc' },
            });
            const periods = periodsRaw.map((p) => this.deserializePeriod(p));
            this.logger.debug({ positionId, count: periods.length }, 'Retrieved APR periods');
            log.methodExit(this.logger, 'getAprPeriods', { count: periods.length });
            return periods;
        }
        catch (error) {
            log.methodError(this.logger, 'getAprPeriods', error, { positionId });
            throw error;
        }
    }
    async getCurrentApr(positionId) {
        log.methodEntry(this.logger, 'getCurrentApr', { positionId });
        try {
            const periods = await this.getAprPeriods(positionId);
            if (periods.length === 0) {
                this.logger.debug({ positionId }, 'No APR periods found');
                log.methodExit(this.logger, 'getCurrentApr', { apr: null });
                return null;
            }
            const currentApr = periods[0].aprBps;
            this.logger.debug({ positionId, aprBps: currentApr }, 'Retrieved current APR');
            log.methodExit(this.logger, 'getCurrentApr', { apr: currentApr });
            return currentApr;
        }
        catch (error) {
            log.methodError(this.logger, 'getCurrentApr', error, { positionId });
            throw error;
        }
    }
    async getAverageApr(positionId) {
        log.methodEntry(this.logger, 'getAverageApr', { positionId });
        try {
            const periods = await this.getAprPeriods(positionId);
            if (periods.length === 0) {
                this.logger.debug({ positionId }, 'No APR periods found');
                log.methodExit(this.logger, 'getAverageApr', { apr: null });
                return null;
            }
            const sum = periods.reduce((acc, period) => acc + period.aprBps, 0);
            const average = Math.round(sum / periods.length);
            this.logger.debug({ positionId, aprBps: average }, 'Calculated average APR');
            log.methodExit(this.logger, 'getAverageApr', { apr: average });
            return average;
        }
        catch (error) {
            log.methodError(this.logger, 'getAverageApr', error, { positionId });
            throw error;
        }
    }
    divideEventsIntoPeriods(events) {
        const periods = [];
        let currentPeriod = [];
        for (const event of events) {
            currentPeriod.push(event);
            if (event.eventType === 'COLLECT') {
                periods.push(currentPeriod);
                currentPeriod = [event];
            }
        }
        if (currentPeriod.length > 0) {
            const lastPeriodEndedWithCollect = periods.length > 0 && periods[periods.length - 1][periods[periods.length - 1].length - 1].eventType === 'COLLECT';
            if (!lastPeriodEndedWithCollect || currentPeriod.length > 1) {
                periods.push(currentPeriod);
            }
        }
        return periods;
    }
    buildAprPeriodFromEvents(positionId, events) {
        if (events.length === 0) {
            throw new Error('Cannot build APR period from empty event array');
        }
        const startEvent = events[0];
        const endEvent = events[events.length - 1];
        const startTimestamp = startEvent.timestamp;
        const endTimestamp = endEvent.timestamp;
        const costBasis = calculateTimeWeightedCostBasis(events);
        const collectedFeeValue = events
            .filter((e) => e.eventType === 'COLLECT')
            .reduce((sum, e) => {
            const feeSum = e.rewards.reduce((acc, reward) => acc + reward.tokenValue, 0n);
            return sum + feeSum;
        }, 0n);
        let aprBps;
        let durationSeconds;
        try {
            durationSeconds = calculateDurationSeconds(startTimestamp, endTimestamp);
            aprBps = calculateAprBps(collectedFeeValue, costBasis, durationSeconds);
        }
        catch (error) {
            this.logger.warn({
                positionId,
                startEventId: startEvent.id,
                endEventId: endEvent.id,
                error: error.message,
            }, 'Failed to calculate APR, defaulting to 0');
            aprBps = 0;
            durationSeconds = 0;
        }
        return {
            positionId,
            startEventId: startEvent.id,
            endEventId: endEvent.id,
            startTimestamp,
            endTimestamp,
            durationSeconds,
            costBasis,
            collectedFeeValue,
            aprBps,
            eventCount: events.length,
        };
    }
    deserializeEvent(dbEvent) {
        return {
            ...dbEvent,
            poolPrice: BigInt(dbEvent.poolPrice),
            token0Amount: BigInt(dbEvent.token0Amount),
            token1Amount: BigInt(dbEvent.token1Amount),
            tokenValue: BigInt(dbEvent.tokenValue),
            deltaCostBasis: BigInt(dbEvent.deltaCostBasis),
            costBasisAfter: BigInt(dbEvent.costBasisAfter),
            deltaPnl: BigInt(dbEvent.deltaPnl),
            pnlAfter: BigInt(dbEvent.pnlAfter),
            rewards: dbEvent.rewards.map((r) => ({
                tokenId: r.tokenId,
                tokenAmount: BigInt(r.tokenAmount),
                tokenValue: BigInt(r.tokenValue),
            })),
        };
    }
    deserializePeriod(dbPeriod) {
        if (!dbPeriod || !dbPeriod.costBasis || !dbPeriod.collectedFeeValue) {
            throw new Error('Invalid database result: missing required fields');
        }
        return {
            ...dbPeriod,
            costBasis: BigInt(dbPeriod.costBasis),
            collectedFeeValue: BigInt(dbPeriod.collectedFeeValue),
        };
    }
}
//# sourceMappingURL=position-apr-service.js.map