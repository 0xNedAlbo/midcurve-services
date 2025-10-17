/**
 * Service layer types
 * Database-specific types and conversion utilities (not shared with UI)
 */

// User input types
export type { CreateUserInput, UpdateUserInput } from './user/index.js';

// Token input types
export type {
  CreateTokenInput,
  UpdateTokenInput,
  CreateErc20TokenInput,
  CreateAnyTokenInput,
  UpdateErc20TokenInput,
  UpdateAnyTokenInput,
  TokenDiscoverInputMap,
  TokenDiscoverInput,
  Erc20TokenDiscoverInput,
  AnyTokenDiscoverInput,
} from './token/index.js';

// Pool input types
export type {
  UniswapV3PoolDiscoverInput,
  PoolDiscoverInputMap,
  PoolDiscoverInput,
  AnyPoolDiscoverInput,
  CreatePoolInput,
  CreateUniswapV3PoolInput,
  CreateAnyPoolInput,
  UpdatePoolInput,
  UpdateUniswapV3PoolInput,
  UpdateAnyPoolInput,
} from './pool/index.js';

// Pool price input types
export type {
  UniswapV3PoolPriceDiscoverInput,
  PoolPriceDiscoverInputMap,
  PoolPriceDiscoverInput,
  AnyPoolPriceDiscoverInput,
  CreatePoolPriceInput,
  UpdatePoolPriceInput,
  CreateUniswapV3PoolPriceInput,
  UpdateUniswapV3PoolPriceInput,
  CreateAnyPoolPriceInput,
  UpdateAnyPoolPriceInput,
} from './pool-price/index.js';

// Uniswap V3 service types
export type { UniswapV3PoolStateDB } from './uniswapv3/index.js';
export { toPoolState, toPoolStateDB } from './uniswapv3/index.js';

// Position input types
export type {
  CreatePositionInput,
  UpdatePositionInput,
  UniswapV3PositionDiscoverInput,
  PositionDiscoverInput,
} from './position/index.js';
