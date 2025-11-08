import { PrismaClient } from '@prisma/client';
import type { Token, TokenConfigMap } from '@midcurve/shared';
import type { CreateTokenInput, UpdateTokenInput, TokenDiscoverInput, TokenSearchInput, TokenSearchCandidate } from '../types/token/token-input.js';
import type { ServiceLogger } from '../../logging/index.js';
export interface TokenServiceDependencies {
    prisma?: PrismaClient;
}
interface TokenDbResult {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    tokenType: string;
    name: string;
    symbol: string;
    decimals: number;
    logoUrl: string | null;
    coingeckoId: string | null;
    marketCap: number | null;
    config: unknown;
}
export declare abstract class TokenService<T extends keyof TokenConfigMap> {
    protected readonly _prisma: PrismaClient;
    protected readonly logger: ServiceLogger;
    constructor(dependencies?: TokenServiceDependencies);
    protected get prisma(): PrismaClient;
    abstract parseConfig(configDB: unknown): TokenConfigMap[T];
    abstract serializeConfig(config: TokenConfigMap[T]): unknown;
    abstract discover(params: TokenDiscoverInput<T>): Promise<Token<T>>;
    abstract searchTokens(input: TokenSearchInput<T>): Promise<TokenSearchCandidate<T>[]>;
    protected mapToToken(dbResult: TokenDbResult): Token<T>;
    findById(id: string): Promise<Token<T> | null>;
    create(input: CreateTokenInput<T>): Promise<Token<T>>;
    update(id: string, input: UpdateTokenInput<T>): Promise<Token<T>>;
    delete(id: string): Promise<void>;
}
export {};
//# sourceMappingURL=token-service.d.ts.map