import { CacheService } from '../cache/cache-service.js';
export class AuthNonceService {
    cacheService;
    NONCE_TTL = 600;
    NONCE_PREFIX = 'nonce:';
    constructor(dependencies = {}) {
        this.cacheService = dependencies.cacheService ?? CacheService.getInstance();
    }
    async generateNonce() {
        const { customAlphabet } = await import('nanoid');
        const generateAlphanumeric = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 32);
        const nonce = generateAlphanumeric();
        const key = `${this.NONCE_PREFIX}${nonce}`;
        await this.cacheService.set(key, { createdAt: new Date().toISOString() }, this.NONCE_TTL);
        return nonce;
    }
    async validateNonce(nonce) {
        const key = `${this.NONCE_PREFIX}${nonce}`;
        const data = await this.cacheService.get(key);
        return data !== null;
    }
    async consumeNonce(nonce) {
        const key = `${this.NONCE_PREFIX}${nonce}`;
        await this.cacheService.delete(key);
    }
}
//# sourceMappingURL=auth-nonce-service.js.map