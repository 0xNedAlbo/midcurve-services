import type { PublicClient } from 'viem';
import type { UniswapV3PoolConfig, UniswapV3PoolState } from '@midcurve/shared';
export declare class PoolConfigError extends Error {
    readonly address: string;
    readonly cause?: unknown | undefined;
    constructor(message: string, address: string, cause?: unknown | undefined);
}
export declare class PoolStateError extends Error {
    readonly address: string;
    readonly cause?: unknown | undefined;
    constructor(message: string, address: string, cause?: unknown | undefined);
}
export declare function readPoolConfig(client: PublicClient, address: string, chainId: number): Promise<UniswapV3PoolConfig>;
export declare function readPoolState(client: PublicClient, address: string): Promise<UniswapV3PoolState>;
//# sourceMappingURL=pool-reader.d.ts.map