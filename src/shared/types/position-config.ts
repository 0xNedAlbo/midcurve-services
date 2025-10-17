/**
 * Position Configuration Types
 *
 * Protocol-specific configuration types for Position.config field.
 * These are stored as JSON in the database.
 *
 * This file uses a mapped types pattern to enforce correct config/state pairing.
 * Each protocol is mapped to its specific config and state types.
 */

import type { UniswapV3PositionConfig } from './uniswapv3/position-config.js';
import type { UniswapV3PositionState } from './uniswapv3/position-state.js';

// Re-export for convenience
export type { UniswapV3PositionConfig } from './uniswapv3/position-config.js';

/**
 * Position Config/State Mapping
 *
 * Maps protocol identifiers to their corresponding config and state types.
 * This ensures type safety: Position<'uniswapv3'> can only have
 * UniswapV3PositionConfig and UniswapV3PositionState.
 *
 * When adding a new protocol:
 * 1. Create the config interface (e.g., OrcaPositionConfig)
 * 2. Create the state interface (e.g., OrcaPositionState)
 * 3. Add entry to this mapping: orca: { config: OrcaPositionConfig; state: OrcaPositionState }
 */
export interface PositionConfigMap {
  uniswapv3: {
    config: UniswapV3PositionConfig;
    state: UniswapV3PositionState;
  };
  // Future protocols:
  // orca: { config: OrcaPositionConfig; state: OrcaPositionState };
  // raydium: { config: RaydiumPositionConfig; state: RaydiumPositionState };
  // pancakeswapv3: { config: PancakeSwapV3PositionConfig; state: PancakeSwapV3PositionState };
}

/**
 * Type alias for Uniswap V3 position
 * Re-exported from position.ts for convenience
 */
export type { UniswapV3Position, AnyPosition } from './position.js';
