import { PoolPriceService } from "./pool-price-service.js";
import type { PoolPriceServiceDependencies } from "./pool-price-service.js";
import type { UniswapV3PoolPriceConfig, UniswapV3PoolPriceState } from "@midcurve/shared";
import type { UniswapV3PoolPrice } from "@midcurve/shared";
import type { CreatePoolPriceInput, UniswapV3PoolPriceDiscoverInput } from "../types/pool-price/pool-price-input.js";
export declare class UniswapV3PoolPriceService extends PoolPriceService<"uniswapv3"> {
    constructor(dependencies?: PoolPriceServiceDependencies);
    parseConfig(configDB: unknown): UniswapV3PoolPriceConfig;
    serializeConfig(config: UniswapV3PoolPriceConfig): unknown;
    parseState(stateDB: unknown): UniswapV3PoolPriceState;
    serializeState(state: UniswapV3PoolPriceState): unknown;
    discover(poolId: string, params: UniswapV3PoolPriceDiscoverInput): Promise<UniswapV3PoolPrice>;
    create(input: CreatePoolPriceInput<"uniswapv3">): Promise<UniswapV3PoolPrice>;
    findById(id: string): Promise<UniswapV3PoolPrice | null>;
    findByPoolId(poolId: string): Promise<UniswapV3PoolPrice[]>;
    findByPoolIdAndTimeRange(poolId: string, startTime: Date, endTime: Date): Promise<UniswapV3PoolPrice[]>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=uniswapv3-pool-price-service.d.ts.map