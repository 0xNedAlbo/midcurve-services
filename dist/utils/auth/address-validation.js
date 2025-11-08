import { normalizeAddress, isValidAddress } from '@midcurve/shared';
export const SUPPORTED_CHAIN_IDS = [
    1,
    42161,
    8453,
    56,
    137,
    10,
];
export const CHAIN_NAMES = {
    1: 'Ethereum',
    42161: 'Arbitrum',
    8453: 'Base',
    56: 'BSC',
    137: 'Polygon',
    10: 'Optimism',
};
export function validateAndNormalizeAddress(address) {
    if (!isValidAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
    }
    return normalizeAddress(address);
}
export function validateChainId(chainId) {
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
        throw new Error(`Unsupported chain ID: ${chainId}. Supported chains: ${SUPPORTED_CHAIN_IDS.map((id) => `${id} (${CHAIN_NAMES[id]})`).join(', ')}`);
    }
}
export function isSupportedChainId(chainId) {
    return SUPPORTED_CHAIN_IDS.includes(chainId);
}
//# sourceMappingURL=address-validation.js.map