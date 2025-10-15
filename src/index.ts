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

// Export services here as they are implemented
// Example:
// export * from './services/position-service.js';
// export * from './services/risk-service.js';
// export * from './services/rebalance-service.js';

export const version = '0.1.0';
