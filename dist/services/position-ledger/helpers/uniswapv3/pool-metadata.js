import { log } from '../../../../logging/index.js';
export async function fetchPoolWithTokens(poolId, prisma, logger) {
    log.dbOperation(logger, 'findUnique', 'Pool', { id: poolId });
    const pool = await prisma.pool.findUnique({
        where: { id: poolId },
        include: {
            token0: true,
            token1: true,
        },
    });
    if (!pool) {
        throw new Error(`Pool not found: ${poolId}`);
    }
    if (!pool.token0 || !pool.token1) {
        throw new Error(`Pool tokens not found for pool: ${poolId}`);
    }
    const token0IsQuote = false;
    return {
        pool: pool,
        token0: pool.token0,
        token1: pool.token1,
        token0IsQuote,
        token0Decimals: pool.token0.decimals,
        token1Decimals: pool.token1.decimals,
    };
}
//# sourceMappingURL=pool-metadata.js.map