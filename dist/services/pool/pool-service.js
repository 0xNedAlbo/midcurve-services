import { PrismaClient } from '@prisma/client';
import { createServiceLogger, log } from '../../logging/index.js';
export class PoolService {
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
            token0Id: input.token0Id,
            token1Id: input.token1Id,
        });
        try {
            const configDB = this.serializeConfig(input.config);
            const stateDB = this.serializeState(input.state);
            log.dbOperation(this.logger, 'create', 'Pool', {
                protocol: input.protocol,
                poolType: input.poolType,
            });
            const result = await this.prisma.pool.create({
                data: {
                    protocol: input.protocol,
                    poolType: input.poolType,
                    token0Id: input.token0Id,
                    token1Id: input.token1Id,
                    feeBps: input.feeBps,
                    config: configDB,
                    state: stateDB,
                },
                include: {
                    token0: true,
                    token1: true,
                },
            });
            const config = this.parseConfig(result.config);
            const state = this.parseState(result.state);
            const pool = {
                id: result.id,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                protocol: result.protocol,
                poolType: result.poolType,
                token0: result.token0,
                token1: result.token1,
                feeBps: result.feeBps,
                config,
                state,
            };
            this.logger.info({
                id: pool.id,
                protocol: pool.protocol,
                poolType: pool.poolType,
            }, 'Pool created');
            log.methodExit(this.logger, 'create', { id: pool.id });
            return pool;
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
            log.dbOperation(this.logger, 'findUnique', 'Pool', { id });
            const result = await this.prisma.pool.findUnique({
                where: { id },
                include: {
                    token0: true,
                    token1: true,
                },
            });
            if (!result) {
                log.methodExit(this.logger, 'findById', { id, found: false });
                return null;
            }
            const config = this.parseConfig(result.config);
            const state = this.parseState(result.state);
            const pool = {
                id: result.id,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                protocol: result.protocol,
                poolType: result.poolType,
                token0: result.token0,
                token1: result.token1,
                feeBps: result.feeBps,
                config,
                state,
            };
            log.methodExit(this.logger, 'findById', { id, found: true });
            return pool;
        }
        catch (error) {
            log.methodError(this.logger, 'findById', error, { id });
            throw error;
        }
    }
    async update(id, input) {
        log.methodEntry(this.logger, 'update', { id, input });
        try {
            const data = {};
            if (input.feeBps !== undefined) {
                data.feeBps = input.feeBps;
            }
            if (input.config !== undefined) {
                data.config = this.serializeConfig(input.config);
            }
            if (input.state !== undefined) {
                data.state = this.serializeState(input.state);
            }
            log.dbOperation(this.logger, 'update', 'Pool', { id, fields: Object.keys(data) });
            const result = await this.prisma.pool.update({
                where: { id },
                data,
                include: {
                    token0: true,
                    token1: true,
                },
            });
            const config = this.parseConfig(result.config);
            const state = this.parseState(result.state);
            const pool = {
                id: result.id,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                protocol: result.protocol,
                poolType: result.poolType,
                token0: result.token0,
                token1: result.token1,
                feeBps: result.feeBps,
                config,
                state,
            };
            log.methodExit(this.logger, 'update', { id });
            return pool;
        }
        catch (error) {
            log.methodError(this.logger, 'update', error, { id });
            throw error;
        }
    }
    async delete(id) {
        log.methodEntry(this.logger, 'delete', { id });
        try {
            log.dbOperation(this.logger, 'delete', 'Pool', { id });
            await this.prisma.pool.delete({
                where: { id },
            });
            log.methodExit(this.logger, 'delete', { id, deleted: true });
        }
        catch (error) {
            if (error.code === 'P2025') {
                this.logger.debug({ id }, 'Pool not found, delete operation is no-op');
                log.methodExit(this.logger, 'delete', { id, deleted: false });
                return;
            }
            log.methodError(this.logger, 'delete', error, { id });
            throw error;
        }
    }
}
//# sourceMappingURL=pool-service.js.map