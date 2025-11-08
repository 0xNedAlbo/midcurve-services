import { validateAndNormalizeAddress } from '../../utils/auth/index.js';
export class AuthUserService {
    prisma;
    constructor(dependencies = {}) {
        this.prisma = dependencies.prisma ?? new (require('@prisma/client').PrismaClient)();
    }
    async findUserById(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                walletAddresses: true,
                apiKeys: {
                    select: {
                        id: true,
                        name: true,
                        keyPrefix: true,
                        lastUsed: true,
                        createdAt: true,
                        updatedAt: true,
                        userId: true,
                    },
                },
            },
        });
    }
    async findUserByWallet(address, chainId) {
        const normalizedAddress = validateAndNormalizeAddress(address);
        const wallet = await this.prisma.authWalletAddress.findUnique({
            where: {
                address_chainId: {
                    address: normalizedAddress,
                    chainId,
                },
            },
            include: { user: true },
        });
        return wallet?.user ?? null;
    }
    async createUser(data) {
        const { walletAddress, walletChainId, ...userData } = data;
        if (walletAddress && walletChainId) {
            const normalizedAddress = validateAndNormalizeAddress(walletAddress);
            return this.prisma.user.create({
                data: {
                    ...userData,
                    walletAddresses: {
                        create: {
                            address: normalizedAddress,
                            chainId: walletChainId,
                            isPrimary: true,
                        },
                    },
                },
                include: {
                    walletAddresses: true,
                },
            });
        }
        return this.prisma.user.create({
            data: userData,
        });
    }
    async updateUser(userId, data) {
        return this.prisma.user.update({
            where: { id: userId },
            data,
        });
    }
    async findWalletByAddress(address, chainId) {
        const normalizedAddress = validateAndNormalizeAddress(address);
        return this.prisma.authWalletAddress.findUnique({
            where: {
                address_chainId: {
                    address: normalizedAddress,
                    chainId,
                },
            },
            include: { user: true },
        });
    }
    async createWallet(userId, address, chainId, isPrimary = false) {
        const normalizedAddress = validateAndNormalizeAddress(address);
        if (isPrimary) {
            await this.prisma.authWalletAddress.updateMany({
                where: { userId },
                data: { isPrimary: false },
            });
        }
        return this.prisma.authWalletAddress.create({
            data: {
                userId,
                address: normalizedAddress,
                chainId,
                isPrimary,
            },
        });
    }
    async linkWallet(userId, address, chainId) {
        const normalizedAddress = validateAndNormalizeAddress(address);
        const existing = await this.findWalletByAddress(normalizedAddress, chainId);
        if (existing) {
            throw new Error('Wallet already registered to a user');
        }
        return this.createWallet(userId, normalizedAddress, chainId, false);
    }
    async getUserWallets(userId) {
        return this.prisma.authWalletAddress.findMany({
            where: { userId },
            orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'asc' },
            ],
        });
    }
    async setPrimaryWallet(userId, walletId) {
        const wallet = await this.prisma.authWalletAddress.findUnique({
            where: { id: walletId },
        });
        if (!wallet || wallet.userId !== userId) {
            throw new Error('Wallet not found or does not belong to user');
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.authWalletAddress.updateMany({
                where: { userId },
                data: { isPrimary: false },
            });
            return tx.authWalletAddress.update({
                where: { id: walletId },
                data: { isPrimary: true },
            });
        });
    }
    async isWalletAvailable(address, chainId) {
        const wallet = await this.findWalletByAddress(address, chainId);
        return wallet === null;
    }
}
//# sourceMappingURL=auth-user-service.js.map