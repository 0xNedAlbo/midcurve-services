import { uniswapV3PoolAbi } from './pool-abi.js';
export class PoolConfigError extends Error {
    address;
    cause;
    constructor(message, address, cause) {
        super(message);
        this.address = address;
        this.cause = cause;
        this.name = 'PoolConfigError';
    }
}
export class PoolStateError extends Error {
    address;
    cause;
    constructor(message, address, cause) {
        super(message);
        this.address = address;
        this.cause = cause;
        this.name = 'PoolStateError';
    }
}
export async function readPoolConfig(client, address, chainId) {
    try {
        const results = await client.multicall({
            contracts: [
                {
                    address: address,
                    abi: uniswapV3PoolAbi,
                    functionName: 'token0',
                },
                {
                    address: address,
                    abi: uniswapV3PoolAbi,
                    functionName: 'token1',
                },
                {
                    address: address,
                    abi: uniswapV3PoolAbi,
                    functionName: 'fee',
                },
                {
                    address: address,
                    abi: uniswapV3PoolAbi,
                    functionName: 'tickSpacing',
                },
            ],
            allowFailure: false,
        });
        const [token0, token1, fee, tickSpacing] = results;
        if (typeof token0 !== 'string' || token0.length !== 42) {
            throw new PoolConfigError(`Pool contract returned invalid token0 address: ${token0}`, address);
        }
        if (typeof token1 !== 'string' || token1.length !== 42) {
            throw new PoolConfigError(`Pool contract returned invalid token1 address: ${token1}`, address);
        }
        if (typeof fee !== 'number' || fee < 0) {
            throw new PoolConfigError(`Pool contract returned invalid fee: ${fee}`, address);
        }
        if (typeof tickSpacing !== 'number') {
            throw new PoolConfigError(`Pool contract returned invalid tickSpacing: ${tickSpacing}`, address);
        }
        return {
            chainId,
            address,
            token0,
            token1,
            feeBps: fee,
            tickSpacing,
        };
    }
    catch (error) {
        if (error instanceof PoolConfigError) {
            throw error;
        }
        throw new PoolConfigError(`Failed to read pool configuration from ${address}: ${error instanceof Error ? error.message : String(error)}`, address, error);
    }
}
export async function readPoolState(client, address) {
    try {
        const results = await client.multicall({
            contracts: [
                {
                    address: address,
                    abi: uniswapV3PoolAbi,
                    functionName: 'slot0',
                },
                {
                    address: address,
                    abi: uniswapV3PoolAbi,
                    functionName: 'liquidity',
                },
                {
                    address: address,
                    abi: uniswapV3PoolAbi,
                    functionName: 'feeGrowthGlobal0X128',
                },
                {
                    address: address,
                    abi: uniswapV3PoolAbi,
                    functionName: 'feeGrowthGlobal1X128',
                },
            ],
            allowFailure: false,
        });
        const [slot0Result, liquidityResult, feeGrowthGlobal0Result, feeGrowthGlobal1Result] = results;
        if (!Array.isArray(slot0Result) || slot0Result.length < 2) {
            throw new PoolStateError(`Pool contract returned invalid slot0 data`, address);
        }
        const [sqrtPriceX96, currentTick] = slot0Result;
        if (typeof sqrtPriceX96 !== 'bigint') {
            throw new PoolStateError(`Pool contract returned invalid sqrtPriceX96: ${sqrtPriceX96}`, address);
        }
        if (typeof currentTick !== 'number') {
            throw new PoolStateError(`Pool contract returned invalid currentTick: ${currentTick}`, address);
        }
        if (typeof liquidityResult !== 'bigint') {
            throw new PoolStateError(`Pool contract returned invalid liquidity: ${liquidityResult}`, address);
        }
        if (typeof feeGrowthGlobal0Result !== 'bigint') {
            throw new PoolStateError(`Pool contract returned invalid feeGrowthGlobal0X128: ${feeGrowthGlobal0Result}`, address);
        }
        if (typeof feeGrowthGlobal1Result !== 'bigint') {
            throw new PoolStateError(`Pool contract returned invalid feeGrowthGlobal1X128: ${feeGrowthGlobal1Result}`, address);
        }
        return {
            sqrtPriceX96,
            currentTick,
            liquidity: liquidityResult,
            feeGrowthGlobal0: feeGrowthGlobal0Result,
            feeGrowthGlobal1: feeGrowthGlobal1Result,
        };
    }
    catch (error) {
        if (error instanceof PoolStateError) {
            throw error;
        }
        throw new PoolStateError(`Failed to read pool state from ${address}: ${error instanceof Error ? error.message : String(error)}`, address, error);
    }
}
//# sourceMappingURL=pool-reader.js.map