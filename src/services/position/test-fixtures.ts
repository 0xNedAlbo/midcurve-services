/**
 * Test fixtures for PositionService tests
 * Provides reusable, realistic test data for Uniswap V3 position testing
 */

import type { CreatePositionInput } from '../types/position/position-input.js';
import type {
  UniswapV3PositionConfig,
  UniswapV3PositionState,
  UniswapV3Position,
} from '../../shared/types/uniswapv3/position.js';
import type { Erc20Token } from '../../shared/types/token.js';

/**
 * Fixture structure for positions
 * Contains input (for create), dbResult (for mock return), and full position object
 * Note: input includes state for testing, though typically state is computed during discovery
 */
interface PositionFixture {
  input: CreatePositionInput<'uniswapv3'> & { state: UniswapV3PositionState };
  dbResult: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    protocol: string;
    positionType: string;
    userId: string;
    currentValue: string;
    currentCostBasis: string;
    realizedPnl: string;
    unrealizedPnl: string;
    collectedFees: string;
    unClaimedFees: string;
    lastFeesCollectedAt: Date;
    priceRangeLower: string;
    priceRangeUpper: string;
    baseTokenId: string;
    quoteTokenId: string;
    poolId: string;
    positionOpenedAt: Date;
    positionClosedAt: Date | null;
    isActive: boolean;
    config: unknown;
    state: unknown;
  };
  position: UniswapV3Position;
}

// ============================================================================
// User Fixtures
// ============================================================================

export const TEST_USER_ID = 'user_alice_001';
export const TEST_USER_ID_2 = 'user_bob_001';

// ============================================================================
// Token Fixtures
// ============================================================================

export const USDC_TOKEN: Erc20Token = {
  id: 'token_usdc_eth_001',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  tokenType: 'erc20',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  config: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
  },
};

export const WETH_TOKEN: Erc20Token = {
  id: 'token_weth_eth_001',
  createdAt: new Date('2024-01-02T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
  tokenType: 'erc20',
  name: 'Wrapped Ether',
  symbol: 'WETH',
  decimals: 18,
  config: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    chainId: 1,
  },
};

// ============================================================================
// Pool ID Fixtures
// ============================================================================

export const USDC_WETH_POOL_ID = 'pool_usdc_weth_001';

// ============================================================================
// Position Config Fixtures
// ============================================================================

export const ACTIVE_POSITION_CONFIG: UniswapV3PositionConfig = {
  chainId: 1,
  nftId: 123456,
  poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
  token0IsQuote: true, // token0 = USDC (quote), token1 = WETH (base)
  tickLower: -887220,
  tickUpper: 887220,
};

export const NARROW_POSITION_CONFIG: UniswapV3PositionConfig = {
  chainId: 1,
  nftId: 123457,
  poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
  token0IsQuote: true,
  tickLower: 200000,
  tickUpper: 205000,
};

// ============================================================================
// Position State Fixtures
// ============================================================================

export const ACTIVE_POSITION_STATE: UniswapV3PositionState = {
  ownerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
  liquidity: 1000000000000000000n,
  feeGrowthInside0LastX128: 123456789012345678901234567890n,
  feeGrowthInside1LastX128: 987654321098765432109876543210n,
  tokensOwed0: 500000n, // 0.5 USDC
  tokensOwed1: 100000000000000000n, // 0.1 WETH
};

export const ZERO_POSITION_STATE: UniswapV3PositionState = {
  ownerAddress: '0x0000000000000000000000000000000000000000',
  liquidity: 0n,
  feeGrowthInside0LastX128: 0n,
  feeGrowthInside1LastX128: 0n,
  tokensOwed0: 0n,
  tokensOwed1: 0n,
};

// ============================================================================
// Complete Position Fixtures
// ============================================================================

/**
 * Active ETH/USDC position with liquidity and fees
 * - User: Alice
 * - Pool: USDC/WETH 0.05%
 * - Range: Full range (-887220 to 887220)
 * - Status: Active with unclaimed fees
 */
export const ACTIVE_ETH_USDC_POSITION: PositionFixture = {
  input: {
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID,
    baseTokenId: WETH_TOKEN.id, // WETH is base
    quoteTokenId: USDC_TOKEN.id, // USDC is quote
    poolId: USDC_WETH_POOL_ID,
    config: ACTIVE_POSITION_CONFIG,
    state: ACTIVE_POSITION_STATE,
  },
  dbResult: {
    id: 'position_001',
    createdAt: new Date('2024-06-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID,
    currentValue: '1500000000', // 1500 USDC
    currentCostBasis: '1000000000', // 1000 USDC
    realizedPnl: '0',
    unrealizedPnl: '500000000', // 500 USDC profit
    collectedFees: '25000000', // 25 USDC collected
    unClaimedFees: '5000000', // 5 USDC unclaimed
    lastFeesCollectedAt: new Date('2024-06-01T00:00:00Z'),
    priceRangeLower: '1400000000', // 1400 USDC per ETH
    priceRangeUpper: '2000000000', // 2000 USDC per ETH
    baseTokenId: WETH_TOKEN.id,
    quoteTokenId: USDC_TOKEN.id,
    poolId: USDC_WETH_POOL_ID,
    positionOpenedAt: new Date('2024-05-01T00:00:00Z'),
    positionClosedAt: null,
    isActive: true,
    config: {
      chainId: 1,
      nftId: 123456,
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0IsQuote: true,
      tickLower: -887220,
      tickUpper: 887220,
    },
    state: {
      ownerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      liquidity: '1000000000000000000',
      feeGrowthInside0LastX128: '123456789012345678901234567890',
      feeGrowthInside1LastX128: '987654321098765432109876543210',
      tokensOwed0: '500000',
      tokensOwed1: '100000000000000000',
    },
  },
  position: {
    id: 'position_001',
    createdAt: new Date('2024-06-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID,
    currentValue: 1500000000n,
    currentCostBasis: 1000000000n,
    realizedPnl: 0n,
    unrealizedPnl: 500000000n,
    collectedFees: 25000000n,
    unClaimedFees: 5000000n,
    lastFeesCollectedAt: new Date('2024-06-01T00:00:00Z'),
    priceRangeLower: 1400000000n,
    priceRangeUpper: 2000000000n,
    baseTokenId: WETH_TOKEN.id,
    quoteTokenId: USDC_TOKEN.id,
    poolId: USDC_WETH_POOL_ID,
    positionOpenedAt: new Date('2024-05-01T00:00:00Z'),
    positionClosedAt: null,
    isActive: true,
    config: ACTIVE_POSITION_CONFIG,
    state: ACTIVE_POSITION_STATE,
  },
};

/**
 * Closed position (no longer active)
 * - User: Alice
 * - Status: Closed with realized PnL
 */
export const CLOSED_POSITION: PositionFixture = {
  input: {
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID,
    baseTokenId: WETH_TOKEN.id,
    quoteTokenId: USDC_TOKEN.id,
    poolId: USDC_WETH_POOL_ID,
    config: {
      chainId: 1,
      nftId: 123458,
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0IsQuote: true,
      tickLower: -887220,
      tickUpper: 887220,
    },
    state: ZERO_POSITION_STATE,
  },
  dbResult: {
    id: 'position_002',
    createdAt: new Date('2024-03-01T00:00:00Z'),
    updatedAt: new Date('2024-05-01T00:00:00Z'),
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID,
    currentValue: '0',
    currentCostBasis: '0',
    realizedPnl: '100000000', // 100 USDC profit
    unrealizedPnl: '0',
    collectedFees: '50000000', // 50 USDC collected
    unClaimedFees: '0',
    lastFeesCollectedAt: new Date('2024-05-01T00:00:00Z'),
    priceRangeLower: '1400000000',
    priceRangeUpper: '2000000000',
    baseTokenId: WETH_TOKEN.id,
    quoteTokenId: USDC_TOKEN.id,
    poolId: USDC_WETH_POOL_ID,
    positionOpenedAt: new Date('2024-03-01T00:00:00Z'),
    positionClosedAt: new Date('2024-05-01T00:00:00Z'),
    isActive: false,
    config: {
      chainId: 1,
      nftId: 123458,
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0IsQuote: true,
      tickLower: -887220,
      tickUpper: 887220,
    },
    state: {
      ownerAddress: '0x0000000000000000000000000000000000000000',
      liquidity: '0',
      feeGrowthInside0LastX128: '0',
      feeGrowthInside1LastX128: '0',
      tokensOwed0: '0',
      tokensOwed1: '0',
    },
  },
  position: {
    id: 'position_002',
    createdAt: new Date('2024-03-01T00:00:00Z'),
    updatedAt: new Date('2024-05-01T00:00:00Z'),
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID,
    currentValue: 0n,
    currentCostBasis: 0n,
    realizedPnl: 100000000n,
    unrealizedPnl: 0n,
    collectedFees: 50000000n,
    unClaimedFees: 0n,
    lastFeesCollectedAt: new Date('2024-05-01T00:00:00Z'),
    priceRangeLower: 1400000000n,
    priceRangeUpper: 2000000000n,
    baseTokenId: WETH_TOKEN.id,
    quoteTokenId: USDC_TOKEN.id,
    poolId: USDC_WETH_POOL_ID,
    positionOpenedAt: new Date('2024-03-01T00:00:00Z'),
    positionClosedAt: new Date('2024-05-01T00:00:00Z'),
    isActive: false,
    config: {
      chainId: 1,
      nftId: 123458,
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0IsQuote: true,
      tickLower: -887220,
      tickUpper: 887220,
    },
    state: ZERO_POSITION_STATE,
  },
};

/**
 * Position for different user (Bob)
 * Used for testing multi-user scenarios
 */
export const BOB_POSITION: PositionFixture = {
  input: {
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID_2,
    baseTokenId: WETH_TOKEN.id,
    quoteTokenId: USDC_TOKEN.id,
    poolId: USDC_WETH_POOL_ID,
    config: {
      chainId: 1,
      nftId: 456789,
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0IsQuote: true,
      tickLower: 200000,
      tickUpper: 205000,
    },
    state: {
      ownerAddress: '0x1234567890123456789012345678901234567890',
      liquidity: 500000000000000000n,
      feeGrowthInside0LastX128: 111111111111111111111111111111n,
      feeGrowthInside1LastX128: 222222222222222222222222222222n,
      tokensOwed0: 200000n,
      tokensOwed1: 50000000000000000n,
    },
  },
  dbResult: {
    id: 'position_003',
    createdAt: new Date('2024-06-15T00:00:00Z'),
    updatedAt: new Date('2024-06-15T00:00:00Z'),
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID_2,
    currentValue: '800000000',
    currentCostBasis: '750000000',
    realizedPnl: '0',
    unrealizedPnl: '50000000',
    collectedFees: '10000000',
    unClaimedFees: '2000000',
    lastFeesCollectedAt: new Date('2024-06-15T00:00:00Z'),
    priceRangeLower: '1600000000',
    priceRangeUpper: '1700000000',
    baseTokenId: WETH_TOKEN.id,
    quoteTokenId: USDC_TOKEN.id,
    poolId: USDC_WETH_POOL_ID,
    positionOpenedAt: new Date('2024-06-01T00:00:00Z'),
    positionClosedAt: null,
    isActive: true,
    config: {
      chainId: 1,
      nftId: 456789,
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0IsQuote: true,
      tickLower: 200000,
      tickUpper: 205000,
    },
    state: {
      ownerAddress: '0x1234567890123456789012345678901234567890',
      liquidity: '500000000000000000',
      feeGrowthInside0LastX128: '111111111111111111111111111111',
      feeGrowthInside1LastX128: '222222222222222222222222222222',
      tokensOwed0: '200000',
      tokensOwed1: '50000000000000000',
    },
  },
  position: {
    id: 'position_003',
    createdAt: new Date('2024-06-15T00:00:00Z'),
    updatedAt: new Date('2024-06-15T00:00:00Z'),
    protocol: 'uniswapv3',
    positionType: 'CL_TICKS',
    userId: TEST_USER_ID_2,
    currentValue: 800000000n,
    currentCostBasis: 750000000n,
    realizedPnl: 0n,
    unrealizedPnl: 50000000n,
    collectedFees: 10000000n,
    unClaimedFees: 2000000n,
    lastFeesCollectedAt: new Date('2024-06-15T00:00:00Z'),
    priceRangeLower: 1600000000n,
    priceRangeUpper: 1700000000n,
    baseTokenId: WETH_TOKEN.id,
    quoteTokenId: USDC_TOKEN.id,
    poolId: USDC_WETH_POOL_ID,
    positionOpenedAt: new Date('2024-06-01T00:00:00Z'),
    positionClosedAt: null,
    isActive: true,
    config: {
      chainId: 1,
      nftId: 456789,
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0IsQuote: true,
      tickLower: 200000,
      tickUpper: 205000,
    },
    state: {
      ownerAddress: '0x1234567890123456789012345678901234567890',
      liquidity: 500000000000000000n,
      feeGrowthInside0LastX128: 111111111111111111111111111111n,
      feeGrowthInside1LastX128: 222222222222222222222222222222n,
      tokensOwed0: 200000n,
      tokensOwed1: 50000000000000000n,
    },
  },
};

/**
 * Helper function to create custom position fixtures
 */
export function createPositionFixture(
  overrides: Partial<UniswapV3Position>
): UniswapV3Position {
  return {
    ...ACTIVE_ETH_USDC_POSITION.position,
    ...overrides,
  };
}
