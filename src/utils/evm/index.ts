/**
 * EVM Utilities
 *
 * Address validation, normalization, and ERC-20 token operations
 */

// Address utilities
export {
  isValidAddress,
  normalizeAddress,
  compareAddresses,
} from './address.js';

// ERC-20 token utilities
export { erc20Abi, type TokenMetadata } from './erc20-abi.js';
export { readTokenMetadata, TokenMetadataError } from './erc20-reader.js';
