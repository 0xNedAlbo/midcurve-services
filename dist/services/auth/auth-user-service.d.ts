import type { PrismaClient, User, AuthWalletAddress } from '@prisma/client';
import type { CreateUserInput, UpdateUserInput } from '../types/auth/index.js';
export interface AuthUserServiceDependencies {
    prisma?: PrismaClient;
}
export declare class AuthUserService {
    private readonly prisma;
    constructor(dependencies?: AuthUserServiceDependencies);
    findUserById(userId: string): Promise<User | null>;
    findUserByWallet(address: string, chainId: number): Promise<User | null>;
    createUser(data: CreateUserInput): Promise<User>;
    updateUser(userId: string, data: UpdateUserInput): Promise<User>;
    findWalletByAddress(address: string, chainId: number): Promise<AuthWalletAddress | null>;
    createWallet(userId: string, address: string, chainId: number, isPrimary?: boolean): Promise<AuthWalletAddress>;
    linkWallet(userId: string, address: string, chainId: number): Promise<AuthWalletAddress>;
    getUserWallets(userId: string): Promise<AuthWalletAddress[]>;
    setPrimaryWallet(userId: string, walletId: string): Promise<AuthWalletAddress>;
    isWalletAvailable(address: string, chainId: number): Promise<boolean>;
}
//# sourceMappingURL=auth-user-service.d.ts.map