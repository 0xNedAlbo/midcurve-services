/**
 * Uniswap V3 Pool State Reader
 *
 * Utilities for reading pool state from Uniswap V3 contracts.
 * Uses viem's multicall for efficient batch reads.
 */

import type { PublicClient } from 'viem';
import { uniswapV3PoolAbi } from './pool-abi.js';
import type { UniswapV3PoolState } from '../../shared/types/uniswapv3/pool.js';

/**
 * Error thrown when pool state cannot be read from contract
 */
export class PoolStateError extends Error {
  constructor(
    message: string,
    public readonly address: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PoolStateError';
  }
}

/**
 * Read pool state from a Uniswap V3 pool contract
 *
 * Uses viem's multicall to fetch slot0, liquidity, and fee growth values
 * in a single RPC call. This is more efficient than making four separate
 * contract calls.
 *
 * @param client - Viem PublicClient configured for the correct chain
 * @param address - Pool contract address (must be checksummed)
 * @returns Pool state with native bigint values
 * @throws PoolStateError if contract doesn't implement Uniswap V3 pool interface
 *
 * @example
 * ```typescript
 * const client = evmConfig.getPublicClient(1);
 * const state = await readPoolState(
 *   client,
 *   '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'
 * );
 * // {
 * //   sqrtPriceX96: 1461446703485210103287273052203988822378723970341n,
 * //   currentTick: -197312,
 * //   liquidity: 27831485581196817042n,
 * //   feeGrowthGlobal0: 123456789n,
 * //   feeGrowthGlobal1: 987654321n
 * // }
 * ```
 */
export async function readPoolState(
  client: PublicClient,
  address: string
): Promise<UniswapV3PoolState> {
  try {
    // Use multicall for efficient batch reading
    const results = await client.multicall({
      contracts: [
        {
          address: address as `0x${string}`,
          abi: uniswapV3PoolAbi,
          functionName: 'slot0',
        },
        {
          address: address as `0x${string}`,
          abi: uniswapV3PoolAbi,
          functionName: 'liquidity',
        },
        {
          address: address as `0x${string}`,
          abi: uniswapV3PoolAbi,
          functionName: 'feeGrowthGlobal0X128',
        },
        {
          address: address as `0x${string}`,
          abi: uniswapV3PoolAbi,
          functionName: 'feeGrowthGlobal1X128',
        },
      ],
      allowFailure: false, // Throw if any call fails
    });

    // Extract results from multicall response
    const [slot0, liquidity, feeGrowthGlobal0, feeGrowthGlobal1] = results;

    // Validate slot0 structure
    if (!Array.isArray(slot0) || slot0.length < 2) {
      throw new PoolStateError(
        'Pool contract returned invalid slot0 data',
        address
      );
    }

    const sqrtPriceX96 = slot0[0];
    const currentTick = slot0[1];

    // Validate sqrtPriceX96
    if (typeof sqrtPriceX96 !== 'bigint' || sqrtPriceX96 <= 0n) {
      throw new PoolStateError(
        'Pool contract returned invalid sqrtPriceX96 value',
        address
      );
    }

    // Validate currentTick (must be within valid range for int24)
    if (typeof currentTick !== 'number') {
      throw new PoolStateError(
        'Pool contract returned invalid tick value',
        address
      );
    }

    // Validate liquidity
    if (typeof liquidity !== 'bigint') {
      throw new PoolStateError(
        'Pool contract returned invalid liquidity value',
        address
      );
    }

    // Validate fee growth values
    if (typeof feeGrowthGlobal0 !== 'bigint') {
      throw new PoolStateError(
        'Pool contract returned invalid feeGrowthGlobal0X128 value',
        address
      );
    }

    if (typeof feeGrowthGlobal1 !== 'bigint') {
      throw new PoolStateError(
        'Pool contract returned invalid feeGrowthGlobal1X128 value',
        address
      );
    }

    return {
      sqrtPriceX96,
      currentTick,
      liquidity,
      feeGrowthGlobal0: feeGrowthGlobal0,
      feeGrowthGlobal1: feeGrowthGlobal1,
    };
  } catch (error) {
    // If it's already a PoolStateError, rethrow it
    if (error instanceof PoolStateError) {
      throw error;
    }

    // Wrap other errors in PoolStateError
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    throw new PoolStateError(
      `Failed to read pool state from contract: ${errorMessage}`,
      address,
      error
    );
  }
}
