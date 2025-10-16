/**
 * UniswapV3PositionService
 *
 * Specialized service for Uniswap V3 position management.
 * Handles serialization/deserialization of Uniswap V3 position config and state.
 */

import { PrismaClient } from '@prisma/client';
import type {
  UniswapV3PositionConfig,
  UniswapV3PositionState,
} from '../../shared/types/uniswapv3/position.js';
import { PositionService } from './position-service.js';

/**
 * Dependencies for UniswapV3PositionService
 * All dependencies are optional and will use defaults if not provided
 */
export interface UniswapV3PositionServiceDependencies {
  /**
   * Prisma client for database operations
   * If not provided, a new PrismaClient instance will be created
   */
  prisma?: PrismaClient;
}

/**
 * UniswapV3PositionService
 *
 * Provides position management for Uniswap V3 concentrated liquidity positions.
 * Implements serialization methods for Uniswap V3-specific config and state types.
 */
export class UniswapV3PositionService extends PositionService<'uniswapv3'> {
  /**
   * Creates a new UniswapV3PositionService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   */
  constructor(dependencies: UniswapV3PositionServiceDependencies = {}) {
    super(dependencies);
  }

  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================================================

  /**
   * Parse config from database JSON to application type
   *
   * For Uniswap V3, config contains only primitive types (no bigint),
   * so this is essentially a pass-through with type casting.
   *
   * @param configDB - Config object from database (JSON)
   * @returns Parsed Uniswap V3 config
   */
  parseConfig(configDB: unknown): UniswapV3PositionConfig {
    const db = configDB as {
      chainId: number;
      nftId: number;
      poolAddress: string;
      token0IsQuote: boolean;
      tickUpper: number;
      tickLower: number;
    };

    return {
      chainId: db.chainId,
      nftId: db.nftId,
      poolAddress: db.poolAddress,
      token0IsQuote: db.token0IsQuote,
      tickUpper: db.tickUpper,
      tickLower: db.tickLower,
    };
  }

  /**
   * Serialize config from application type to database JSON
   *
   * For Uniswap V3, config contains only primitive types (no bigint),
   * so this is essentially a pass-through.
   *
   * @param config - Application config
   * @returns Serialized config for database storage (JSON-serializable)
   */
  serializeConfig(config: UniswapV3PositionConfig): unknown {
    return {
      chainId: config.chainId,
      nftId: config.nftId,
      poolAddress: config.poolAddress,
      token0IsQuote: config.token0IsQuote,
      tickUpper: config.tickUpper,
      tickLower: config.tickLower,
    };
  }

  /**
   * Parse state from database JSON to application type
   *
   * Converts string values to bigint for Uniswap V3 state fields
   * (liquidity, feeGrowth values, tokensOwed).
   *
   * @param stateDB - State object from database (JSON with string values)
   * @returns Parsed Uniswap V3 state with bigint values
   */
  parseState(stateDB: unknown): UniswapV3PositionState {
    const db = stateDB as {
      ownerAddress: string;
      liquidity: string;
      feeGrowthInside0LastX128: string;
      feeGrowthInside1LastX128: string;
      tokensOwed0: string;
      tokensOwed1: string;
    };

    return {
      ownerAddress: db.ownerAddress,
      liquidity: BigInt(db.liquidity),
      feeGrowthInside0LastX128: BigInt(db.feeGrowthInside0LastX128),
      feeGrowthInside1LastX128: BigInt(db.feeGrowthInside1LastX128),
      tokensOwed0: BigInt(db.tokensOwed0),
      tokensOwed1: BigInt(db.tokensOwed1),
    };
  }

  /**
   * Serialize state from application type to database JSON
   *
   * Converts bigint values to strings for database storage.
   *
   * @param state - Application state with bigint values
   * @returns Serialized state with string values (JSON-serializable)
   */
  serializeState(state: UniswapV3PositionState): unknown {
    return {
      ownerAddress: state.ownerAddress,
      liquidity: state.liquidity.toString(),
      feeGrowthInside0LastX128: state.feeGrowthInside0LastX128.toString(),
      feeGrowthInside1LastX128: state.feeGrowthInside1LastX128.toString(),
      tokensOwed0: state.tokensOwed0.toString(),
      tokensOwed1: state.tokensOwed1.toString(),
    };
  }
}
