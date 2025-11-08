import { createHash } from 'crypto';
import { customAlphabet } from 'nanoid';
export class AuthApiKeyService {
    prisma;
    constructor(dependencies = {}) {
        this.prisma = dependencies.prisma ?? new (require('@prisma/client').PrismaClient)();
    }
    async createApiKey(userId, name) {
        const key = this.generateKey();
        const keyHash = this.hashKey(key);
        const keyPrefix = key.slice(0, 8);
        const apiKey = await this.prisma.apiKey.create({
            data: {
                userId,
                name,
                keyHash,
                keyPrefix,
            },
        });
        return { apiKey, key };
    }
    async validateApiKey(key) {
        const keyHash = this.hashKey(key);
        return this.prisma.apiKey.findUnique({
            where: { keyHash },
            include: {
                user: {
                    include: {
                        walletAddresses: true,
                    },
                },
            },
        });
    }
    async getUserApiKeys(userId) {
        return this.prisma.apiKey.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                keyPrefix: true,
                lastUsed: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
    async revokeApiKey(userId, keyId) {
        const apiKey = await this.prisma.apiKey.findUnique({
            where: { id: keyId },
        });
        if (!apiKey || apiKey.userId !== userId) {
            throw new Error('API key not found or does not belong to user');
        }
        await this.prisma.apiKey.delete({
            where: { id: keyId },
        });
    }
    async updateLastUsed(keyId) {
        this.prisma.apiKey
            .update({
            where: { id: keyId },
            data: { lastUsed: new Date() },
        })
            .catch((err) => {
            console.error('Failed to update API key lastUsed:', err);
        });
    }
    generateKey() {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const nanoid = customAlphabet(alphabet, 32);
        return `mc_live_${nanoid()}`;
    }
    hashKey(key) {
        return createHash('sha256').update(key).digest('hex');
    }
}
//# sourceMappingURL=auth-api-key-service.js.map