/**
 * Utility functions for Midcurve Finance
 */

// EVM address utilities
export { isValidAddress, normalizeAddress, compareAddresses } from './evm.js';

// ERC-20 token utilities
export {
  erc20Abi,
  type TokenMetadata,
} from './erc20-abi.js';
export {
  readTokenMetadata,
  TokenMetadataError,
} from './erc20-reader.js';
