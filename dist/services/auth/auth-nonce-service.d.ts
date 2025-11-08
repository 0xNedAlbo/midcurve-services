import { CacheService } from '../cache/cache-service.js';
export interface AuthNonceServiceDependencies {
    cacheService?: CacheService;
}
export declare class AuthNonceService {
    private readonly cacheService;
    private readonly NONCE_TTL;
    private readonly NONCE_PREFIX;
    constructor(dependencies?: AuthNonceServiceDependencies);
    generateNonce(): Promise<string>;
    validateNonce(nonce: string): Promise<boolean>;
    consumeNonce(nonce: string): Promise<void>;
}
//# sourceMappingURL=auth-nonce-service.d.ts.map