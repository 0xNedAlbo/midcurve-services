import type { PrismaClient, ApiKey } from '@prisma/client';
import type { ApiKeyCreationResult } from '../types/auth/index.js';
export interface AuthApiKeyServiceDependencies {
    prisma?: PrismaClient;
}
export declare class AuthApiKeyService {
    private readonly prisma;
    constructor(dependencies?: AuthApiKeyServiceDependencies);
    createApiKey(userId: string, name: string): Promise<ApiKeyCreationResult>;
    validateApiKey(key: string): Promise<ApiKey | null>;
    getUserApiKeys(userId: string): Promise<Array<{
        id: string;
        name: string;
        keyPrefix: string;
        lastUsed: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>>;
    revokeApiKey(userId: string, keyId: string): Promise<void>;
    updateLastUsed(keyId: string): Promise<void>;
    private generateKey;
    private hashKey;
}
//# sourceMappingURL=auth-api-key-service.d.ts.map