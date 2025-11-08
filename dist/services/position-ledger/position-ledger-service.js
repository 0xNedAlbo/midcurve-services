import { PrismaClient } from '@prisma/client';
import { createServiceLogger, log } from '../../logging/index.js';
import { PositionAprService } from '../position-apr/position-apr-service.js';
export class PositionLedgerService {
    _prisma;
    _aprService;
    logger;
    constructor(dependencies = {}) {
        this._prisma = dependencies.prisma ?? new PrismaClient();
        this._aprService = dependencies.aprService ?? new PositionAprService({ prisma: this._prisma });
        this.logger = createServiceLogger(this.constructor.name);
    }
    get prisma() {
        return this._prisma;
    }
    get aprService() {
        return this._aprService;
    }
    mapToLedgerEvent(dbResult) {
        const rewardsDB = dbResult.rewards;
        const rewards = rewardsDB.map((r) => ({
            tokenId: r.tokenId,
            tokenAmount: BigInt(r.tokenAmount),
            tokenValue: BigInt(r.tokenValue),
        }));
        return {
            id: dbResult.id,
            createdAt: dbResult.createdAt,
            updatedAt: dbResult.updatedAt,
            positionId: dbResult.positionId,
            protocol: dbResult.protocol,
            previousId: dbResult.previousId,
            timestamp: dbResult.timestamp,
            eventType: dbResult.eventType,
            inputHash: dbResult.inputHash,
            poolPrice: BigInt(dbResult.poolPrice),
            token0Amount: BigInt(dbResult.token0Amount),
            token1Amount: BigInt(dbResult.token1Amount),
            tokenValue: BigInt(dbResult.tokenValue),
            rewards,
            deltaCostBasis: BigInt(dbResult.deltaCostBasis),
            costBasisAfter: BigInt(dbResult.costBasisAfter),
            deltaPnl: BigInt(dbResult.deltaPnl),
            pnlAfter: BigInt(dbResult.pnlAfter),
            config: this.parseConfig(dbResult.config),
            state: this.parseState(dbResult.state),
        };
    }
    async validateEventSequence(positionId, previousId, protocol) {
        log.methodEntry(this.logger, 'validateEventSequence', {
            positionId,
            previousId,
            protocol,
        });
        try {
            if (!previousId) {
                this.logger.debug({ positionId }, 'First event in chain, no validation needed');
                log.methodExit(this.logger, 'validateEventSequence', {
                    firstEvent: true,
                });
                return;
            }
            log.dbOperation(this.logger, 'findUnique', 'PositionLedgerEvent', {
                id: previousId,
            });
            const previousEvent = await this.prisma.positionLedgerEvent.findUnique({
                where: { id: previousId },
            });
            if (!previousEvent) {
                const error = new Error(`Previous event ${previousId} not found for position ${positionId}`);
                log.methodError(this.logger, 'validateEventSequence', error, {
                    positionId,
                    previousId,
                });
                throw error;
            }
            if (previousEvent.positionId !== positionId) {
                const error = new Error(`Previous event ${previousId} belongs to position ${previousEvent.positionId}, not ${positionId}`);
                log.methodError(this.logger, 'validateEventSequence', error, {
                    positionId,
                    previousId,
                    previousPositionId: previousEvent.positionId,
                });
                throw error;
            }
            if (previousEvent.protocol !== protocol) {
                const error = new Error(`Previous event ${previousId} is protocol ${previousEvent.protocol}, not ${protocol}`);
                log.methodError(this.logger, 'validateEventSequence', error, {
                    positionId,
                    previousId,
                    expectedProtocol: protocol,
                    actualProtocol: previousEvent.protocol,
                });
                throw error;
            }
            this.logger.debug({
                positionId,
                previousId,
                protocol,
            }, 'Event sequence validated successfully');
            log.methodExit(this.logger, 'validateEventSequence', {
                positionId,
                previousId,
            });
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes('not found') ||
                    error.message.includes('belongs to') ||
                    error.message.includes('is protocol')))) {
                log.methodError(this.logger, 'validateEventSequence', error, {
                    positionId,
                    previousId,
                });
            }
            throw error;
        }
    }
    async findAllItems(positionId) {
        log.methodEntry(this.logger, 'findAllItems', { positionId });
        try {
            log.dbOperation(this.logger, 'findMany', 'PositionLedgerEvent', {
                positionId,
            });
            const results = await this.prisma.positionLedgerEvent.findMany({
                where: {
                    positionId,
                    protocol: String(this.constructor.name.toLowerCase().replace('positionledgerservice', '')),
                },
                orderBy: {
                    timestamp: 'desc',
                },
            });
            const events = results.map((r) => this.mapToLedgerEvent(r));
            this.logger.debug({
                positionId,
                count: events.length,
            }, 'Events retrieved successfully');
            log.methodExit(this.logger, 'findAllItems', {
                positionId,
                count: events.length,
            });
            return events;
        }
        catch (error) {
            log.methodError(this.logger, 'findAllItems', error, {
                positionId,
            });
            throw error;
        }
    }
    async getMostRecentEvent(positionId) {
        log.methodEntry(this.logger, 'getMostRecentEvent', { positionId });
        try {
            const events = await this.findAllItems(positionId);
            if (events.length === 0) {
                log.methodExit(this.logger, 'getMostRecentEvent', {
                    positionId,
                    found: false,
                });
                return null;
            }
            const mostRecentEvent = events[0];
            log.methodExit(this.logger, 'getMostRecentEvent', {
                positionId,
                eventId: mostRecentEvent.id,
                eventType: mostRecentEvent.eventType,
                timestamp: mostRecentEvent.timestamp,
            });
            return mostRecentEvent;
        }
        catch (error) {
            log.methodError(this.logger, 'getMostRecentEvent', error, {
                positionId,
            });
            throw error;
        }
    }
    async addItem(positionId, input) {
        log.methodEntry(this.logger, 'addItem', {
            positionId,
            eventType: input.eventType,
            timestamp: input.timestamp,
        });
        try {
            await this.validateEventSequence(positionId, input.previousId, input.protocol);
            const inputHash = this.generateInputHash(input);
            this.logger.debug({ positionId, inputHash }, 'Input hash generated');
            const existingEvent = await this.prisma.positionLedgerEvent.findFirst({
                where: {
                    positionId,
                    inputHash,
                },
            });
            if (existingEvent) {
                this.logger.info({ positionId, inputHash, existingEventId: existingEvent.id }, 'Event already exists (duplicate inputHash), skipping insert');
                log.methodExit(this.logger, 'addItem', { id: existingEvent.id, skipped: true });
                return this.findAllItems(positionId);
            }
            const configDB = this.serializeConfig(input.config);
            const stateDB = this.serializeState(input.state);
            const rewardsDB = input.rewards.map((r) => ({
                tokenId: r.tokenId,
                tokenAmount: r.tokenAmount.toString(),
                tokenValue: r.tokenValue.toString(),
            }));
            log.dbOperation(this.logger, 'create', 'PositionLedgerEvent', {
                positionId,
                eventType: input.eventType,
            });
            const result = await this.prisma.positionLedgerEvent.create({
                data: {
                    positionId,
                    protocol: input.protocol,
                    previousId: input.previousId,
                    timestamp: input.timestamp,
                    eventType: input.eventType,
                    inputHash,
                    poolPrice: input.poolPrice.toString(),
                    token0Amount: input.token0Amount.toString(),
                    token1Amount: input.token1Amount.toString(),
                    tokenValue: input.tokenValue.toString(),
                    rewards: rewardsDB,
                    deltaCostBasis: input.deltaCostBasis.toString(),
                    costBasisAfter: input.costBasisAfter.toString(),
                    deltaPnl: input.deltaPnl.toString(),
                    pnlAfter: input.pnlAfter.toString(),
                    config: configDB,
                    state: stateDB,
                },
            });
            this.logger.info({
                id: result.id,
                positionId,
                eventType: input.eventType,
                timestamp: input.timestamp,
            }, 'Event created successfully');
            log.methodExit(this.logger, 'addItem', { id: result.id });
            return this.findAllItems(positionId);
        }
        catch (error) {
            log.methodError(this.logger, 'addItem', error, {
                positionId,
                eventType: input.eventType,
            });
            throw error;
        }
    }
    async deleteAllItems(positionId) {
        log.methodEntry(this.logger, 'deleteAllItems', { positionId });
        try {
            log.dbOperation(this.logger, 'deleteMany', 'PositionLedgerEvent', {
                positionId,
            });
            const result = await this.prisma.positionLedgerEvent.deleteMany({
                where: {
                    positionId,
                    protocol: String(this.constructor.name.toLowerCase().replace('positionledgerservice', '')),
                },
            });
            this.logger.info({
                positionId,
                count: result.count,
            }, 'Events deleted successfully');
            log.methodExit(this.logger, 'deleteAllItems', {
                positionId,
                count: result.count,
            });
        }
        catch (error) {
            log.methodError(this.logger, 'deleteAllItems', error, {
                positionId,
            });
            throw error;
        }
    }
}
//# sourceMappingURL=position-ledger-service.js.map