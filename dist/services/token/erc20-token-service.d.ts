import { PrismaClient } from "@prisma/client";
import type { Token } from '@midcurve/shared';
import type { Erc20TokenConfig } from '@midcurve/shared';
import type { CreateTokenInput, UpdateTokenInput, Erc20TokenDiscoverInput, Erc20TokenSearchInput, Erc20TokenSearchCandidate } from "../types/token/token-input.js";
import { TokenService } from "./token-service.js";
import { EvmConfig } from "../../config/evm.js";
import { CoinGeckoClient } from "../../clients/coingecko/index.js";
export interface Erc20TokenServiceDependencies {
    prisma?: PrismaClient;
    evmConfig?: EvmConfig;
    coinGeckoClient?: CoinGeckoClient;
}
export declare class Erc20TokenService extends TokenService<"erc20"> {
    private readonly _evmConfig;
    private readonly _coinGeckoClient;
    constructor(dependencies?: Erc20TokenServiceDependencies);
    protected get evmConfig(): EvmConfig;
    protected get coinGeckoClient(): CoinGeckoClient;
    parseConfig(configDB: unknown): Erc20TokenConfig;
    serializeConfig(config: Erc20TokenConfig): unknown;
    discover(params: Erc20TokenDiscoverInput): Promise<Token<"erc20">>;
    findById(id: string): Promise<Token<"erc20"> | null>;
    create(input: CreateTokenInput<"erc20">): Promise<Token<"erc20">>;
    update(id: string, input: UpdateTokenInput<"erc20">): Promise<Token<"erc20">>;
    delete(id: string): Promise<void>;
    findByAddressAndChain(address: string, chainId: number): Promise<Token<"erc20"> | null>;
    enrichToken(tokenId: string): Promise<Token<"erc20">>;
    searchTokens(input: Erc20TokenSearchInput): Promise<Erc20TokenSearchCandidate[]>;
    private getPlatformId;
}
//# sourceMappingURL=erc20-token-service.d.ts.map