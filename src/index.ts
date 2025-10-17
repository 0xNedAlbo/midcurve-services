/**
 * Midcurve Finance - Shared Services
 *
 * Business logic for concentrated liquidity position management
 * across multiple DEX protocols:
 * - Uniswap V3 (Ethereum)
 * - Orca (Solana)
 * - Raydium (Solana)
 * - PancakeSwap (BSC)
 */

// Export shared types
// These are used across API, UI, and Workers
export * from './shared/types/index.js';

// Export utilities
export * from './utils/index.js';

// Export configuration
export * from './config/index.js';

// Export logging utilities
export * from './logging/index.js';

// Export clients
export * from './clients/index.js';

// Export services
export * from './services/user/index.js';
export * from './services/token/index.js';
export * from './services/pool/index.js';
export * from './services/pool-price/index.js';
export * from './services/position/index.js';
export * from './services/cache/index.js';

export const version = '0.1.0';
