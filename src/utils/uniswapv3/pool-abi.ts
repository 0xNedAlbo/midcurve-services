/**
 * Uniswap V3 Pool ABI
 *
 * Minimal ABI definition for reading Uniswap V3 pool state.
 * Includes only the functions needed for state refresh:
 * - slot0() - Current price and tick information
 * - liquidity() - Current pool liquidity
 * - feeGrowthGlobal0X128() - Accumulated fees for token0
 * - feeGrowthGlobal1X128() - Accumulated fees for token1
 */

/**
 * Minimal Uniswap V3 Pool ABI for state functions
 * Type-safe with viem's ABI format
 */
export const uniswapV3PoolAbi = [
  {
    type: 'function',
    name: 'slot0',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'liquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
  },
  {
    type: 'function',
    name: 'feeGrowthGlobal0X128',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'feeGrowthGlobal1X128',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * Slot0 data structure returned by the pool contract
 * Contains the current price and tick information
 */
export interface Slot0 {
  /** Current sqrt(price) as a Q64.96 fixed-point value */
  sqrtPriceX96: bigint;
  /** Current tick of the pool */
  tick: number;
  /** Index of the last written observation */
  observationIndex: number;
  /** Current maximum number of observations */
  observationCardinality: number;
  /** Next maximum number of observations to be written */
  observationCardinalityNext: number;
  /** Protocol fee (if enabled) */
  feeProtocol: number;
  /** Whether the pool is unlocked (not in a swap) */
  unlocked: boolean;
}
