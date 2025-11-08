import type { Logger } from 'pino';
import type { UniswapV3PoolPrice } from '@midcurve/shared';
import type { UniswapV3PoolPriceService } from '../../../pool-price/uniswapv3-pool-price-service.js';
export interface HistoricPoolPrice {
    poolPrice: UniswapV3PoolPrice;
    sqrtPriceX96: bigint;
    timestamp: Date;
}
export declare function getHistoricPoolPrice(poolId: string, blockNumber: bigint, poolPriceService: UniswapV3PoolPriceService, logger: Logger): Promise<HistoricPoolPrice>;
//# sourceMappingURL=pool-price-fetcher.d.ts.map