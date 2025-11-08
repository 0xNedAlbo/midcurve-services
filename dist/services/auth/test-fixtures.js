import { createHash } from 'crypto';
export const ALICE = {
    input: {
        name: 'Alice',
        email: 'alice@example.com',
        image: 'https://example.com/alice.png',
        walletAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        walletChainId: 1,
    },
    dbResult: {
        id: 'user_alice_001',
        name: 'Alice',
        email: 'alice@example.com',
        image: 'https://example.com/alice.png',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
};
export const BOB = {
    input: {
        name: 'Bob',
        email: undefined,
        image: undefined,
    },
    dbResult: {
        id: 'user_bob_001',
        name: 'Bob',
        email: null,
        image: null,
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    },
};
export const CHARLIE = {
    input: {
        name: 'Charlie',
        email: 'charlie@example.com',
        image: undefined,
    },
    dbResult: {
        id: 'user_charlie_001',
        name: 'Charlie',
        email: 'charlie@example.com',
        image: null,
        createdAt: new Date('2024-01-03T00:00:00.000Z'),
        updatedAt: new Date('2024-01-03T00:00:00.000Z'),
    },
};
export const ALICE_ETHEREUM_WALLET = {
    dbResult: {
        id: 'wallet_alice_eth_001',
        userId: 'user_alice_001',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId: 1,
        isPrimary: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
};
export const ALICE_ARBITRUM_WALLET = {
    dbResult: {
        id: 'wallet_alice_arb_001',
        userId: 'user_alice_001',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        chainId: 42161,
        isPrimary: false,
        createdAt: new Date('2024-01-05T00:00:00.000Z'),
        updatedAt: new Date('2024-01-05T00:00:00.000Z'),
    },
};
export const BOB_BASE_WALLET = {
    dbResult: {
        id: 'wallet_bob_base_001',
        userId: 'user_bob_001',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        chainId: 8453,
        isPrimary: true,
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    },
};
export const UNREGISTERED_WALLET = {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    chainId: 1,
};
function hashKey(key) {
    return createHash('sha256').update(key).digest('hex');
}
const ALICE_KEY_1 = 'mc_live_ABC123xyz789DEF456ghi012JKL345';
export const ALICE_API_KEY_1 = {
    key: ALICE_KEY_1,
    keyHash: hashKey(ALICE_KEY_1),
    dbResult: {
        id: 'apikey_alice_001',
        userId: 'user_alice_001',
        name: 'Production API',
        keyHash: hashKey(ALICE_KEY_1),
        keyPrefix: 'mc_live_',
        lastUsed: new Date('2024-01-10T12:00:00.000Z'),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-10T12:00:00.000Z'),
    },
};
const ALICE_KEY_2 = 'mc_live_MNO678pqr012STU345vwx678YZA901';
export const ALICE_API_KEY_2 = {
    key: ALICE_KEY_2,
    keyHash: hashKey(ALICE_KEY_2),
    dbResult: {
        id: 'apikey_alice_002',
        userId: 'user_alice_001',
        name: 'Development API',
        keyHash: hashKey(ALICE_KEY_2),
        keyPrefix: 'mc_live_',
        lastUsed: null,
        createdAt: new Date('2024-01-05T00:00:00.000Z'),
        updatedAt: new Date('2024-01-05T00:00:00.000Z'),
    },
};
const BOB_KEY = 'mc_live_BCD234efg567HIJ890klm123NOP456';
export const BOB_API_KEY = {
    key: BOB_KEY,
    keyHash: hashKey(BOB_KEY),
    dbResult: {
        id: 'apikey_bob_001',
        userId: 'user_bob_001',
        name: 'Bob API Key',
        keyHash: hashKey(BOB_KEY),
        keyPrefix: 'mc_live_',
        lastUsed: new Date('2024-01-08T08:00:00.000Z'),
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        updatedAt: new Date('2024-01-08T08:00:00.000Z'),
    },
};
export const INVALID_API_KEY = 'invalid_key_format';
export const NON_EXISTENT_API_KEY = 'mc_live_QRS345tuv678WXY901zab234CDE567';
export function createUserFixture(overrides = {}) {
    const id = overrides.id ?? 'user_test_001';
    const name = overrides.name ?? 'Test User';
    const email = overrides.email ?? undefined;
    const image = overrides.image ?? undefined;
    return {
        input: {
            name,
            email,
            image,
            walletAddress: overrides.walletAddress,
            walletChainId: overrides.walletChainId,
        },
        dbResult: {
            id,
            name,
            email: email ?? null,
            image: image ?? null,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
    };
}
export function createWalletFixture(overrides = {}) {
    return {
        dbResult: {
            id: overrides.id ?? 'wallet_test_001',
            userId: overrides.userId ?? 'user_test_001',
            address: overrides.address ?? '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: overrides.chainId ?? 1,
            isPrimary: overrides.isPrimary ?? false,
            createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: overrides.updatedAt ?? new Date('2024-01-01T00:00:00.000Z'),
        },
    };
}
export function createApiKeyFixture(overrides = {}) {
    const key = overrides.key ?? 'mc_live_TEST123xyz456ABC789def012GHI345';
    const keyHash = hashKey(key);
    return {
        key,
        keyHash,
        dbResult: {
            id: overrides.id ?? 'apikey_test_001',
            userId: overrides.userId ?? 'user_test_001',
            name: overrides.name ?? 'Test API Key',
            keyHash,
            keyPrefix: overrides.keyPrefix ?? 'mc_live_',
            lastUsed: overrides.lastUsed ?? null,
            createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: overrides.updatedAt ?? new Date('2024-01-01T00:00:00.000Z'),
        },
    };
}
//# sourceMappingURL=test-fixtures.js.map