import type { User, AuthWalletAddress, ApiKey } from '@prisma/client';
export interface CreateUserInput {
    name?: string;
    email?: string;
    image?: string;
    walletAddress?: string;
    walletChainId?: number;
}
export interface UpdateUserInput {
    name?: string;
    email?: string;
    image?: string;
}
export interface UserWithWallets extends User {
    walletAddresses: AuthWalletAddress[];
}
export interface UserWithApiKeys extends User {
    apiKeys: Omit<ApiKey, 'keyHash'>[];
}
export interface UserWithAuth extends User {
    walletAddresses: AuthWalletAddress[];
    apiKeys: Omit<ApiKey, 'keyHash'>[];
}
export interface ApiKeyCreationResult {
    apiKey: ApiKey;
    key: string;
}
//# sourceMappingURL=auth-input.d.ts.map