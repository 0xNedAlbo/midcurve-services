import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { UniswapV3Pool, Erc20Token } from '@midcurve/shared';
export interface PoolMetadata {
    pool: UniswapV3Pool;
    token0: Erc20Token;
    token1: Erc20Token;
    token0IsQuote: boolean;
    token0Decimals: number;
    token1Decimals: number;
}
export declare function fetchPoolWithTokens(poolId: string, prisma: PrismaClient, logger: Logger): Promise<PoolMetadata>;
//# sourceMappingURL=pool-metadata.d.ts.map