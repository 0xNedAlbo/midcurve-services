import { PrismaClient } from '@prisma/client';
import { createServiceLogger, log } from '../../logging/index.js';
export class PositionService {
    _prisma;
    logger;
    constructor(dependencies = {}) {
        this._prisma = dependencies.prisma ?? new PrismaClient();
        this.logger = createServiceLogger(this.constructor.name);
    }
    get prisma() {
        return this._prisma;
    }
    async create(input) {
        log.methodEntry(this.logger, 'create', {
            protocol: input.protocol,
            userId: input.userId,
            poolId: input.poolId,
        });
        try {
            const configDB = this.serializeConfig(input.config);
            if (!input.state) {
                const error = new Error('state is required for position creation. Use discover() to create from on-chain data.');
                log.methodError(this.logger, 'create', error, { input });
                throw error;
            }
            const stateDB = this.serializeState(input.state);
            const positionHash = this.createPositionHash(input.config);
            const now = new Date();
            const zeroValue = '0';
            log.dbOperation(this.logger, 'create', 'Position', {
                protocol: input.protocol,
                positionType: input.positionType,
                userId: input.userId,
                positionHash,
            });
            const result = await this.prisma.position.create({
                data: {
                    protocol: input.protocol,
                    positionType: input.positionType,
                    userId: input.userId,
                    poolId: input.poolId,
                    isToken0Quote: input.isToken0Quote,
                    positionHash,
                    config: configDB,
                    state: stateDB,
                    currentValue: zeroValue,
                    currentCostBasis: zeroValue,
                    realizedPnl: zeroValue,
                    unrealizedPnl: zeroValue,
                    collectedFees: zeroValue,
                    unClaimedFees: zeroValue,
                    lastFeesCollectedAt: now,
                    priceRangeLower: zeroValue,
                    priceRangeUpper: zeroValue,
                    positionOpenedAt: now,
                    positionClosedAt: null,
                    isActive: true,
                },
                include: {
                    pool: {
                        include: {
                            token0: true,
                            token1: true,
                        },
                    },
                },
            });
            const position = this.mapToPosition(result);
            this.logger.info({
                id: position.id,
                protocol: position.protocol,
                positionType: position.positionType,
                userId: position.userId,
            }, 'Position created');
            log.methodExit(this.logger, 'create', { id: position.id });
            return position;
        }
        catch (error) {
            log.methodError(this.logger, 'create', error, {
                protocol: input.protocol,
            });
            throw error;
        }
    }
    async findById(id) {
        log.methodEntry(this.logger, 'findById', { id });
        try {
            log.dbOperation(this.logger, 'findUnique', 'Position', { id });
            const result = await this.prisma.position.findUnique({
                where: { id },
                include: {
                    pool: {
                        include: {
                            token0: true,
                            token1: true,
                        },
                    },
                },
            });
            if (!result) {
                log.methodExit(this.logger, 'findById', { id, found: false });
                return null;
            }
            const position = this.mapToPosition(result);
            log.methodExit(this.logger, 'findById', { id, found: true });
            return position;
        }
        catch (error) {
            log.methodError(this.logger, 'findById', error, { id });
            throw error;
        }
    }
    async findByPositionHash(userId, positionHash) {
        log.methodEntry(this.logger, 'findByPositionHash', { userId, positionHash });
        try {
            log.dbOperation(this.logger, 'findFirst', 'Position', { userId, positionHash });
            const result = await this.prisma.position.findFirst({
                where: {
                    userId,
                    positionHash,
                },
                include: {
                    pool: {
                        include: {
                            token0: true,
                            token1: true,
                        },
                    },
                },
            });
            if (!result) {
                log.methodExit(this.logger, 'findByPositionHash', { userId, positionHash, found: false });
                return null;
            }
            const position = this.mapToPosition(result);
            log.methodExit(this.logger, 'findByPositionHash', { userId, positionHash, found: true });
            return position;
        }
        catch (error) {
            log.methodError(this.logger, 'findByPositionHash', error, { userId, positionHash });
            throw error;
        }
    }
    async update(id, input) {
        log.methodEntry(this.logger, 'update', { id, input });
        try {
            const data = {};
            log.dbOperation(this.logger, 'update', 'Position', {
                id,
                fields: Object.keys(data),
            });
            const result = await this.prisma.position.update({
                where: { id },
                data,
                include: {
                    pool: {
                        include: {
                            token0: true,
                            token1: true,
                        },
                    },
                },
            });
            const position = this.mapToPosition(result);
            log.methodExit(this.logger, 'update', { id });
            return position;
        }
        catch (error) {
            log.methodError(this.logger, 'update', error, { id });
            throw error;
        }
    }
    async delete(id) {
        log.methodEntry(this.logger, 'delete', { id });
        try {
            log.dbOperation(this.logger, 'delete', 'Position', { id });
            await this.prisma.position.delete({
                where: { id },
            });
            log.methodExit(this.logger, 'delete', { id, deleted: true });
        }
        catch (error) {
            if (error.code === 'P2025') {
                this.logger.debug({ id }, 'Position not found, delete operation is no-op');
                log.methodExit(this.logger, 'delete', { id, deleted: false });
                return;
            }
            log.methodError(this.logger, 'delete', error, { id });
            throw error;
        }
    }
    mapToPosition(dbResult) {
        return {
            id: dbResult.id,
            positionHash: dbResult.positionHash ?? '',
            createdAt: dbResult.createdAt,
            updatedAt: dbResult.updatedAt,
            protocol: dbResult.protocol,
            positionType: dbResult.positionType,
            userId: dbResult.userId,
            currentValue: BigInt(dbResult.currentValue),
            currentCostBasis: BigInt(dbResult.currentCostBasis),
            realizedPnl: BigInt(dbResult.realizedPnl),
            unrealizedPnl: BigInt(dbResult.unrealizedPnl),
            collectedFees: BigInt(dbResult.collectedFees),
            unClaimedFees: BigInt(dbResult.unClaimedFees),
            lastFeesCollectedAt: dbResult.lastFeesCollectedAt,
            priceRangeLower: BigInt(dbResult.priceRangeLower),
            priceRangeUpper: BigInt(dbResult.priceRangeUpper),
            pool: dbResult.pool,
            isToken0Quote: dbResult.isToken0Quote,
            positionOpenedAt: dbResult.positionOpenedAt,
            positionClosedAt: dbResult.positionClosedAt,
            isActive: dbResult.isActive,
            config: this.parseConfig(dbResult.config),
            state: this.parseState(dbResult.state),
        };
    }
}
//# sourceMappingURL=position-service.js.map