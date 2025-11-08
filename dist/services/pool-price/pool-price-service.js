import { PrismaClient } from '@prisma/client';
import { createServiceLogger, log } from '../../logging/index.js';
import { EvmConfig } from '../../config/evm.js';
export class PoolPriceService {
    _prisma;
    _evmConfig;
    logger;
    constructor(dependencies = {}) {
        this._prisma = dependencies.prisma ?? new PrismaClient();
        this._evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
        this.logger = createServiceLogger(this.constructor.name);
    }
    get prisma() {
        return this._prisma;
    }
    get evmConfig() {
        return this._evmConfig;
    }
    async create(input) {
        log.methodEntry(this.logger, 'create', {
            protocol: input.protocol,
            poolId: input.poolId,
            timestamp: input.timestamp,
        });
        try {
            const configDB = this.serializeConfig(input.config);
            const stateDB = this.serializeState(input.state);
            log.dbOperation(this.logger, 'create', 'PoolPrice', {
                protocol: input.protocol,
                poolId: input.poolId,
            });
            const result = await this.prisma.poolPrice.create({
                data: {
                    protocol: input.protocol,
                    poolId: input.poolId,
                    timestamp: input.timestamp,
                    token1PricePerToken0: input.token1PricePerToken0.toString(),
                    token0PricePerToken1: input.token0PricePerToken1.toString(),
                    config: configDB,
                    state: stateDB,
                },
            });
            const poolPrice = this.mapToPoolPrice(result);
            this.logger.info({
                id: poolPrice.id,
                protocol: poolPrice.protocol,
                poolId: poolPrice.poolId,
                timestamp: poolPrice.timestamp,
            }, 'Pool price created');
            log.methodExit(this.logger, 'create', { id: poolPrice.id });
            return poolPrice;
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
            log.dbOperation(this.logger, 'findUnique', 'PoolPrice', { id });
            const result = await this.prisma.poolPrice.findUnique({
                where: { id },
            });
            if (!result) {
                log.methodExit(this.logger, 'findById', { id, found: false });
                return null;
            }
            const poolPrice = this.mapToPoolPrice(result);
            log.methodExit(this.logger, 'findById', { id, found: true });
            return poolPrice;
        }
        catch (error) {
            log.methodError(this.logger, 'findById', error, { id });
            throw error;
        }
    }
    async findByPoolId(poolId) {
        log.methodEntry(this.logger, 'findByPoolId', { poolId });
        try {
            log.dbOperation(this.logger, 'findMany', 'PoolPrice', { poolId });
            const results = await this.prisma.poolPrice.findMany({
                where: { poolId },
                orderBy: { timestamp: 'desc' },
            });
            const poolPrices = results.map((result) => this.mapToPoolPrice(result));
            log.methodExit(this.logger, 'findByPoolId', {
                poolId,
                count: poolPrices.length,
            });
            return poolPrices;
        }
        catch (error) {
            log.methodError(this.logger, 'findByPoolId', error, { poolId });
            throw error;
        }
    }
    async findByPoolIdAndTimeRange(poolId, startTime, endTime) {
        log.methodEntry(this.logger, 'findByPoolIdAndTimeRange', {
            poolId,
            startTime,
            endTime,
        });
        try {
            log.dbOperation(this.logger, 'findMany', 'PoolPrice', {
                poolId,
                timeRange: true,
            });
            const results = await this.prisma.poolPrice.findMany({
                where: {
                    poolId,
                    timestamp: {
                        gte: startTime,
                        lte: endTime,
                    },
                },
                orderBy: { timestamp: 'asc' },
            });
            const poolPrices = results.map((result) => this.mapToPoolPrice(result));
            log.methodExit(this.logger, 'findByPoolIdAndTimeRange', {
                poolId,
                count: poolPrices.length,
            });
            return poolPrices;
        }
        catch (error) {
            log.methodError(this.logger, 'findByPoolIdAndTimeRange', error, {
                poolId,
            });
            throw error;
        }
    }
    async update(id, input) {
        log.methodEntry(this.logger, 'update', { id, input });
        try {
            const data = {};
            if (input.timestamp !== undefined) {
                data.timestamp = input.timestamp;
            }
            if (input.token1PricePerToken0 !== undefined) {
                data.token1PricePerToken0 = input.token1PricePerToken0.toString();
            }
            if (input.token0PricePerToken1 !== undefined) {
                data.token0PricePerToken1 = input.token0PricePerToken1.toString();
            }
            if (input.config !== undefined) {
                data.config = this.serializeConfig(input.config);
            }
            if (input.state !== undefined) {
                data.state = this.serializeState(input.state);
            }
            log.dbOperation(this.logger, 'update', 'PoolPrice', {
                id,
                fields: Object.keys(data),
            });
            const result = await this.prisma.poolPrice.update({
                where: { id },
                data,
            });
            const poolPrice = this.mapToPoolPrice(result);
            log.methodExit(this.logger, 'update', { id });
            return poolPrice;
        }
        catch (error) {
            log.methodError(this.logger, 'update', error, { id });
            throw error;
        }
    }
    async delete(id) {
        log.methodEntry(this.logger, 'delete', { id });
        try {
            log.dbOperation(this.logger, 'delete', 'PoolPrice', { id });
            await this.prisma.poolPrice.delete({
                where: { id },
            });
            log.methodExit(this.logger, 'delete', { id, deleted: true });
        }
        catch (error) {
            if (error.code === 'P2025') {
                this.logger.debug({ id }, 'Pool price not found, delete operation is no-op');
                log.methodExit(this.logger, 'delete', { id, deleted: false });
                return;
            }
            log.methodError(this.logger, 'delete', error, { id });
            throw error;
        }
    }
    mapToPoolPrice(dbResult) {
        return {
            id: dbResult.id,
            createdAt: dbResult.createdAt,
            updatedAt: dbResult.updatedAt,
            protocol: dbResult.protocol,
            poolId: dbResult.poolId,
            timestamp: dbResult.timestamp,
            token1PricePerToken0: BigInt(dbResult.token1PricePerToken0),
            token0PricePerToken1: BigInt(dbResult.token0PricePerToken1),
            config: this.parseConfig(dbResult.config),
            state: this.parseState(dbResult.state),
        };
    }
}
//# sourceMappingURL=pool-price-service.js.map