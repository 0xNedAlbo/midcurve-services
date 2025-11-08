import { PrismaClient } from '@prisma/client';
import { createServiceLogger, log } from '../../logging/index.js';
export class PositionListService {
    _prisma;
    logger;
    constructor(dependencies = {}) {
        this._prisma = dependencies.prisma ?? new PrismaClient();
        this.logger = createServiceLogger('PositionListService');
    }
    get prisma() {
        return this._prisma;
    }
    async list(userId, filters) {
        const { status = 'all', protocols, limit = 20, offset = 0, sortBy = 'createdAt', sortDirection = 'desc', } = filters ?? {};
        log.methodEntry(this.logger, 'list', {
            userId,
            status,
            protocols,
            limit,
            offset,
            sortBy,
            sortDirection,
        });
        try {
            const where = {
                userId,
            };
            if (status === 'active') {
                where.isActive = true;
            }
            else if (status === 'closed') {
                where.isActive = false;
            }
            if (protocols && protocols.length > 0) {
                where.protocol = {
                    in: protocols,
                };
            }
            const validatedLimit = Math.min(Math.max(limit, 1), 100);
            const validatedOffset = Math.max(offset, 0);
            log.dbOperation(this.logger, 'findMany', 'Position', {
                where,
                limit: validatedLimit,
                offset: validatedOffset,
                sortBy,
                sortDirection,
            });
            const [results, total] = await Promise.all([
                this.prisma.position.findMany({
                    where,
                    include: {
                        pool: {
                            include: {
                                token0: true,
                                token1: true,
                            },
                        },
                    },
                    orderBy: {
                        [sortBy]: sortDirection,
                    },
                    take: validatedLimit,
                    skip: validatedOffset,
                }),
                this.prisma.position.count({ where }),
            ]);
            const positions = results.map((result) => this.mapToPosition(result));
            this.logger.info({
                userId,
                status,
                protocols,
                count: positions.length,
                total,
                limit: validatedLimit,
                offset: validatedOffset,
            }, 'Positions retrieved');
            log.methodExit(this.logger, 'list', {
                count: positions.length,
                total,
            });
            return {
                positions,
                total,
                limit: validatedLimit,
                offset: validatedOffset,
            };
        }
        catch (error) {
            log.methodError(this.logger, 'list', error, {
                userId,
                filters,
            });
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
            pool: this.mapPool(dbResult.pool),
            isToken0Quote: dbResult.isToken0Quote,
            positionOpenedAt: dbResult.positionOpenedAt,
            positionClosedAt: dbResult.positionClosedAt,
            isActive: dbResult.isActive,
            config: dbResult.config,
            state: dbResult.state,
        };
    }
    mapPool(dbPool) {
        return {
            id: dbPool.id,
            createdAt: dbPool.createdAt,
            updatedAt: dbPool.updatedAt,
            protocol: dbPool.protocol,
            poolType: dbPool.poolType,
            feeBps: dbPool.feeBps,
            token0: this.mapToken(dbPool.token0),
            token1: this.mapToken(dbPool.token1),
            config: dbPool.config,
            state: dbPool.state,
        };
    }
    mapToken(dbToken) {
        return {
            id: dbToken.id,
            createdAt: dbToken.createdAt,
            updatedAt: dbToken.updatedAt,
            tokenType: dbToken.tokenType,
            name: dbToken.name,
            symbol: dbToken.symbol,
            decimals: dbToken.decimals,
            logoUrl: dbToken.logoUrl ?? undefined,
            coingeckoId: dbToken.coingeckoId ?? undefined,
            marketCap: dbToken.marketCap ?? undefined,
            config: dbToken.config,
        };
    }
}
//# sourceMappingURL=position-list-service.js.map