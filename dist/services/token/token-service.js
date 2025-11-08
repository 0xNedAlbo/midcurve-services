import { PrismaClient } from '@prisma/client';
import { createServiceLogger, log } from '../../logging/index.js';
export class TokenService {
    _prisma;
    logger;
    constructor(dependencies = {}) {
        this._prisma = dependencies.prisma ?? new PrismaClient();
        this.logger = createServiceLogger(this.constructor.name);
    }
    get prisma() {
        return this._prisma;
    }
    mapToToken(dbResult) {
        return {
            id: dbResult.id,
            createdAt: dbResult.createdAt,
            updatedAt: dbResult.updatedAt,
            tokenType: dbResult.tokenType,
            name: dbResult.name,
            symbol: dbResult.symbol,
            decimals: dbResult.decimals,
            logoUrl: dbResult.logoUrl ?? undefined,
            coingeckoId: dbResult.coingeckoId ?? undefined,
            marketCap: dbResult.marketCap ?? undefined,
            config: this.parseConfig(dbResult.config),
        };
    }
    async findById(id) {
        log.methodEntry(this.logger, 'findById', { id });
        try {
            log.dbOperation(this.logger, 'findUnique', 'Token', { id });
            const result = await this.prisma.token.findUnique({
                where: { id },
            });
            if (!result) {
                this.logger.debug({ id }, 'Token not found');
                log.methodExit(this.logger, 'findById', { found: false });
                return null;
            }
            const token = this.mapToToken(result);
            this.logger.debug({ id, symbol: token.symbol, tokenType: token.tokenType }, 'Token found');
            log.methodExit(this.logger, 'findById', { id });
            return token;
        }
        catch (error) {
            log.methodError(this.logger, 'findById', error, { id });
            throw error;
        }
    }
    async create(input) {
        log.methodEntry(this.logger, 'create', {
            tokenType: input.tokenType,
            symbol: input.symbol,
            name: input.name,
        });
        try {
            const configDB = this.serializeConfig(input.config);
            log.dbOperation(this.logger, 'create', 'Token', {
                tokenType: input.tokenType,
                symbol: input.symbol,
            });
            const result = await this.prisma.token.create({
                data: {
                    tokenType: input.tokenType,
                    name: input.name,
                    symbol: input.symbol,
                    decimals: input.decimals,
                    logoUrl: input.logoUrl,
                    coingeckoId: input.coingeckoId,
                    marketCap: input.marketCap,
                    config: configDB,
                },
            });
            const token = this.mapToToken(result);
            this.logger.info({
                id: token.id,
                tokenType: token.tokenType,
                symbol: token.symbol,
                name: token.name,
            }, 'Token created successfully');
            log.methodExit(this.logger, 'create', { id: token.id });
            return token;
        }
        catch (error) {
            log.methodError(this.logger, 'create', error, {
                tokenType: input.tokenType,
                symbol: input.symbol,
            });
            throw error;
        }
    }
    async update(id, input) {
        log.methodEntry(this.logger, 'update', {
            id,
            fields: Object.keys(input),
        });
        try {
            log.dbOperation(this.logger, 'findUnique', 'Token', { id });
            const existing = await this.prisma.token.findUnique({
                where: { id },
            });
            if (!existing) {
                const error = new Error(`Token with id ${id} not found`);
                log.methodError(this.logger, 'update', error, { id });
                throw error;
            }
            const configDB = input.config ? this.serializeConfig(input.config) : undefined;
            log.dbOperation(this.logger, 'update', 'Token', {
                id,
                fields: Object.keys(input),
            });
            const result = await this.prisma.token.update({
                where: { id },
                data: {
                    name: input.name,
                    symbol: input.symbol,
                    decimals: input.decimals,
                    logoUrl: input.logoUrl,
                    coingeckoId: input.coingeckoId,
                    marketCap: input.marketCap,
                    config: configDB,
                },
            });
            const token = this.mapToToken(result);
            this.logger.info({
                id: token.id,
                symbol: token.symbol,
            }, 'Token updated successfully');
            log.methodExit(this.logger, 'update', { id });
            return token;
        }
        catch (error) {
            if (!(error instanceof Error && error.message.includes('not found'))) {
                log.methodError(this.logger, 'update', error, { id });
            }
            throw error;
        }
    }
    async delete(id) {
        log.methodEntry(this.logger, 'delete', { id });
        try {
            log.dbOperation(this.logger, 'findUnique', 'Token', { id });
            const existing = await this.prisma.token.findUnique({
                where: { id },
            });
            if (!existing) {
                this.logger.debug({ id }, 'Token not found, nothing to delete');
                log.methodExit(this.logger, 'delete', { id, found: false });
                return;
            }
            log.dbOperation(this.logger, 'delete', 'Token', { id });
            await this.prisma.token.delete({
                where: { id },
            });
            this.logger.info({
                id,
                symbol: existing.symbol,
                tokenType: existing.tokenType,
            }, 'Token deleted successfully');
            log.methodExit(this.logger, 'delete', { id });
        }
        catch (error) {
            log.methodError(this.logger, 'delete', error, { id });
            throw error;
        }
    }
}
//# sourceMappingURL=token-service.js.map