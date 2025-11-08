import type { User, AuthWalletAddress, ApiKey } from '@prisma/client';
import type { CreateUserInput } from '../types/auth/index.js';
export interface UserFixture {
    input: CreateUserInput;
    dbResult: User;
}
export declare const ALICE: UserFixture;
export declare const BOB: UserFixture;
export declare const CHARLIE: UserFixture;
export interface WalletFixture {
    dbResult: AuthWalletAddress;
}
export declare const ALICE_ETHEREUM_WALLET: WalletFixture;
export declare const ALICE_ARBITRUM_WALLET: WalletFixture;
export declare const BOB_BASE_WALLET: WalletFixture;
export declare const UNREGISTERED_WALLET: {
    address: string;
    chainId: number;
};
export interface ApiKeyFixture {
    key: string;
    keyHash: string;
    dbResult: ApiKey;
}
export declare const ALICE_API_KEY_1: ApiKeyFixture;
export declare const ALICE_API_KEY_2: ApiKeyFixture;
export declare const BOB_API_KEY: ApiKeyFixture;
export declare const INVALID_API_KEY = "invalid_key_format";
export declare const NON_EXISTENT_API_KEY = "mc_live_QRS345tuv678WXY901zab234CDE567";
export declare function createUserFixture(overrides?: Partial<CreateUserInput> & {
    id?: string;
}): UserFixture;
export declare function createWalletFixture(overrides?: Partial<AuthWalletAddress>): WalletFixture;
export declare function createApiKeyFixture(overrides?: Partial<ApiKey> & {
    key?: string;
}): ApiKeyFixture;
//# sourceMappingURL=test-fixtures.d.ts.map