import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { UniswapV3Position } from '@midcurve/shared';
export interface PositionMetadata {
    position: UniswapV3Position;
    nftId: bigint;
    chainId: number;
    poolId: string;
}
export declare function fetchPositionMetadata(positionId: string, prisma: PrismaClient, logger: Logger): Promise<PositionMetadata>;
//# sourceMappingURL=position-metadata.d.ts.map