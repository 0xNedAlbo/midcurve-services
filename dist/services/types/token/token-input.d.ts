import type { Token, TokenConfigMap } from '@midcurve/shared';
export type CreateTokenInput<T extends keyof TokenConfigMap> = Omit<Token<T>, "id" | "createdAt" | "updatedAt">;
export type UpdateTokenInput<T extends keyof TokenConfigMap> = Partial<Omit<Token<T>, "id" | "tokenType" | "createdAt" | "updatedAt">>;
export type CreateErc20TokenInput = CreateTokenInput<"erc20">;
export type CreateAnyTokenInput = CreateTokenInput<keyof TokenConfigMap>;
export type UpdateErc20TokenInput = UpdateTokenInput<"erc20">;
export type UpdateAnyTokenInput = UpdateTokenInput<keyof TokenConfigMap>;
export interface Erc20TokenDiscoverInput {
    address: string;
    chainId: number;
}
export interface TokenDiscoverInputMap {
    erc20: Erc20TokenDiscoverInput;
}
export type TokenDiscoverInput<T extends keyof TokenConfigMap> = TokenDiscoverInputMap[T];
export type AnyTokenDiscoverInput = TokenDiscoverInput<keyof TokenConfigMap>;
export interface Erc20TokenSearchInput {
    chainId: number;
    symbol?: string;
    name?: string;
    address?: string;
}
export interface Erc20TokenSearchCandidate {
    coingeckoId: string;
    symbol: string;
    name: string;
    address: string;
    chainId: number;
    logoUrl?: string;
    marketCap?: number;
}
export interface TokenSearchInputMap {
    erc20: Erc20TokenSearchInput;
}
export interface TokenSearchCandidateMap {
    erc20: Erc20TokenSearchCandidate;
}
export type TokenSearchInput<T extends keyof TokenConfigMap> = TokenSearchInputMap[T];
export type TokenSearchCandidate<T extends keyof TokenConfigMap> = TokenSearchCandidateMap[T];
export type AnyTokenSearchInput = TokenSearchInput<keyof TokenConfigMap>;
export type AnyTokenSearchCandidate = TokenSearchCandidate<keyof TokenConfigMap>;
//# sourceMappingURL=token-input.d.ts.map