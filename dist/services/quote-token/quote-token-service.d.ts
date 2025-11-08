import { PrismaClient } from '@prisma/client';
import type { PoolConfigMap } from '@midcurve/shared';
import type { QuoteTokenResult } from '@midcurve/shared';
import type { QuoteTokenInput } from '../types/quote-token/quote-token-input.js';
import type { ServiceLogger } from '../../logging/index.js';
export interface QuoteTokenServiceDependencies {
    prisma?: PrismaClient;
}
export declare abstract class QuoteTokenService<P extends keyof PoolConfigMap> {
    protected readonly _prisma: PrismaClient;
    protected readonly logger: ServiceLogger;
    constructor(dependencies?: QuoteTokenServiceDependencies);
    protected get prisma(): PrismaClient;
    abstract determineQuoteToken(input: QuoteTokenInput<P>): Promise<QuoteTokenResult<P>>;
    abstract getDefaultQuoteTokens(): string[];
    abstract normalizeTokenId(tokenId: string): string;
    abstract compareTokenIds(tokenIdA: string, tokenIdB: string): boolean;
    setUserPreferences(userId: string, preferredQuoteTokens: string[]): Promise<void>;
    getUserPreferences(userId: string): Promise<string[] | null>;
    resetToDefaults(userId: string): Promise<void>;
    protected abstract getProtocol(): P;
}
//# sourceMappingURL=quote-token-service.d.ts.map