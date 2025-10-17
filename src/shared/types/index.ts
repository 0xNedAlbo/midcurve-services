/**
 * Shared types for Midcurve Finance
 * Used across API, UI, and Workers
 */

// User types
export type { User } from './user.js';

// Token types
export type {
  Token,
  TokenType,
  TokenConfigMap,
  Erc20Token,
  AnyToken,
} from './token.js';
export type { Erc20TokenConfig } from './token-config.js';

// Pool types
export type { Pool, Protocol, PoolType, UniswapV3Pool, AnyPool } from './pool.js';
export type { PoolConfigMap } from './pool-config.js';

// Position types
export type {
  Position,
  PositionProtocol,
  PositionType,
  PositionConfigMap,
  UniswapV3Position,
  AnyPosition,
} from './position.js';

// Pool price types
export type {
  PoolPrice,
  PoolPriceProtocol,
  PoolPriceConfigMap,
  UniswapV3PoolPrice,
  AnyPoolPrice,
} from './pool-price.js';

// Uniswap V3 types (protocol-specific)
export type {
  UniswapV3PoolConfig,
  UniswapV3PoolState,
  UniswapV3PositionConfig,
  UniswapV3PositionState,
  UniswapV3PoolPriceConfig,
  UniswapV3PoolPriceState,
} from './uniswapv3/index.js';
