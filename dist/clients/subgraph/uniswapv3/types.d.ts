export interface SubgraphResponse<T> {
    data?: T;
    errors?: Array<{
        message: string;
        locations?: Array<{
            line: number;
            column: number;
        }>;
        path?: string[];
    }>;
}
export interface PoolMetrics {
    tvlUSD: string;
    volumeUSD: string;
    feesUSD: string;
}
export interface PoolFeeData {
    poolAddress: string;
    chainId: number;
    feeTier: string;
    poolLiquidity: string;
    sqrtPriceX96: string;
    tvlUSD: string;
    volumeUSD: string;
    feesUSD: string;
    token0: {
        address: string;
        symbol: string;
        decimals: number;
        dailyVolume: string;
        price: string;
    };
    token1: {
        address: string;
        symbol: string;
        decimals: number;
        dailyVolume: string;
        price: string;
    };
    calculatedAt: Date;
}
export interface RawPoolData {
    id: string;
    feeTier: string;
    sqrtPrice: string;
    liquidity: string;
    token0: {
        id: string;
        symbol: string;
        decimals: string;
    };
    token1: {
        id: string;
        symbol: string;
        decimals: string;
    };
    poolDayData: Array<{
        date: number;
        liquidity: string;
        volumeToken0: string;
        volumeToken1: string;
        token1Price: string;
        token0Price: string;
        volumeUSD: string;
        feesUSD: string;
        tvlUSD: string;
    }>;
}
export declare class UniswapV3SubgraphApiError extends Error {
    readonly statusCode?: number | undefined;
    readonly graphqlErrors?: Array<{
        message: string;
    }> | undefined;
    constructor(message: string, statusCode?: number | undefined, graphqlErrors?: Array<{
        message: string;
    }> | undefined);
}
export declare class UniswapV3SubgraphUnavailableError extends Error {
    readonly cause?: Error;
    constructor(message: string, cause?: Error);
}
export declare class PoolNotFoundInSubgraphError extends Error {
    readonly chainId: number;
    readonly poolAddress: string;
    constructor(chainId: number, poolAddress: string);
}
//# sourceMappingURL=types.d.ts.map