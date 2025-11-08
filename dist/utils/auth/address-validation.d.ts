export declare const SUPPORTED_CHAIN_IDS: readonly [1, 42161, 8453, 56, 137, 10];
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];
export declare const CHAIN_NAMES: Record<SupportedChainId, string>;
export declare function validateAndNormalizeAddress(address: string): string;
export declare function validateChainId(chainId: number): asserts chainId is SupportedChainId;
export declare function isSupportedChainId(chainId: number): chainId is SupportedChainId;
//# sourceMappingURL=address-validation.d.ts.map