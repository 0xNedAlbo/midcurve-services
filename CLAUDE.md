# Midcurve Services

## Project Overview

**Midcurve Services** is a shared TypeScript library that implements the core business logic for **Midcurve Finance**, a comprehensive risk management platform for concentrated liquidity (CL) provisioning across multiple blockchain ecosystems.

This repository serves as the **single source of truth** for business logic, type definitions, and service layers that power the entire Midcurve Finance product suite.

## Role Within Midcurve Finance Product Suite

Midcurve Services acts as the **foundational layer** that is consumed by:

### 1. **API Project** (Next.js on Vercel)
- RESTful/GraphQL endpoints for frontend consumption
- Serverless functions for efficient, scalable API operations
- Real-time position monitoring and risk calculations
- User authentication and authorization

### 2. **UI/Frontend Application**
- React/Next.js web application
- Dashboard for monitoring CL positions
- Risk analytics and visualizations
- Portfolio management interface

### 3. **Workers/Background Processors**
- Long-running job processors (Node.js)
- Automated rebalancing execution
- Price monitoring and alert triggers
- Historical data aggregation
- Notification services

### Architecture Benefits

```
┌──────────────────────────────────────────────────────┐
│            Midcurve Finance Ecosystem                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐       │
│  │   API   │  │    UI    │  │   Workers    │       │
│  │ (Vercel)│  │ (Next.js)│  │  (Node.js)   │       │
│  └────┬────┘  └─────┬────┘  └──────┬───────┘       │
│       │             │               │               │
│       │             └───────┬───────┘               │
│       │                     │                       │
│       │            ┌────────▼─────────┐             │
│       │            │ @midcurve/shared │             │
│       │            │ Types + Utils    │             │
│       │            └────────┬─────────┘             │
│       │                     │                       │
│       └─────────────────────┘                       │
│                     │                               │
│            ┌────────▼─────────┐                     │
│            │ Midcurve Services│                     │
│            │  (This Project)  │                     │
│            │  Business Logic  │                     │
│            └──────────────────┘                     │
│                     │                               │
│            ┌────────▼─────────┐                     │
│            │    PostgreSQL     │                     │
│            │   (Prisma ORM)    │                     │
│            └──────────────────┘                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Key Advantages:**
- ✅ **Consistency**: Same business logic across all applications
- ✅ **Type Safety**: Shared TypeScript types ensure compile-time safety
- ✅ **Maintainability**: Single codebase for critical business logic
- ✅ **Testability**: Business logic tested independently of applications
- ✅ **Reusability**: Write once, use everywhere (API, UI, Workers)

## Supported Platforms

Midcurve Finance provides risk management for concentrated liquidity positions across multiple DEX protocols:

### Ethereum Ecosystem
- **Uniswap V3** - The original concentrated liquidity AMM on Ethereum mainnet

### Binance Smart Chain (BSC)
- **PancakeSwap V3** - Leading DEX on BSC with concentrated liquidity

### Solana Ecosystem
- **Orca** - User-friendly concentrated liquidity pools
- **Raydium** - High-performance AMM with CL support

## The Abstraction Approach

### Philosophy

Different blockchain platforms have fundamentally different architectures:
- **EVM chains** (Ethereum, BSC): Contract addresses, ERC-20 tokens, gas fees
- **Solana**: Program IDs, SPL tokens, accounts, rent-exempt balances

Rather than creating separate implementations for each platform, Midcurve Services uses an **abstract interface pattern** that:
1. Defines **common fields** shared across all platforms
2. Stores **platform-specific data** in a flexible `config` field
3. Provides **type safety** through TypeScript generics

### Design Pattern

#### Core Abstraction Principles

**Common Fields**: Fields that exist across all platforms
```typescript
interface Token<TConfig> {
  // Database-generated fields
  id: string;
  createdAt: Date;
  updatedAt: Date;

  // Discriminated union for type narrowing
  tokenType: 'evm-erc20' | 'solana-spl';

  // Universal across all chains
  name: string;
  symbol: string;
  decimals: number;
  logoUrl?: string;
  coingeckoId?: string;
  marketCap?: number;

  // Platform-specific (type-safe!)
  config: TConfig;
}
```

**Platform-Specific Config**: Strongly-typed configuration objects
```typescript
// ERC-20 tokens (Ethereum, BSC, Arbitrum, Base, etc.)
interface Erc20TokenConfig {
  address: string;  // 0x... (EIP-55 checksummed)
  chainId: number;  // 1 (Ethereum), 56 (BSC), 42161 (Arbitrum), etc.
}

// Solana SPL tokens
interface SolanaTokenConfig {
  mint: string;      // Base58 pubkey
  programId?: string; // Usually SPL Token Program
}

// Union type for any token
type TokenConfig = Erc20TokenConfig | SolanaTokenConfig;
```

**Type-Safe Usage with Discriminated Unions**:
```typescript
const usdcEth: Erc20Token = {
  id: 'token_001',
  createdAt: new Date(),
  updatedAt: new Date(),
  tokenType: 'evm-erc20',  // Discriminator
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  config: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1
  }
};

const usdcSol: SolanaToken = {
  id: 'token_002',
  createdAt: new Date(),
  updatedAt: new Date(),
  tokenType: 'solana-spl',  // Discriminator
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  config: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  }
};

// Type narrowing with discriminated unions
function processToken(token: AnyToken) {
  if (token.tokenType === 'evm-erc20') {
    // TypeScript knows token.config is Erc20TokenConfig
    console.log(`ERC-20 on chain ${token.config.chainId}`);
  } else {
    // TypeScript knows token.config is SolanaTokenConfig
    console.log(`SPL token: ${token.config.mint}`);
  }
}
```

### Database Strategy

The `config` field is persisted as a **PostgreSQL JSON column**:

```prisma
model Token {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tokenType   String   // 'evm-erc20' or 'solana-spl'
  name        String
  symbol      String
  decimals    Int

  // Optional fields
  logoUrl     String?
  coingeckoId String?
  marketCap   Float?

  // Platform-specific config (JSON)
  config      Json

  // Relations
  poolsAsToken0 Pool[] @relation("PoolToken0")
  poolsAsToken1 Pool[] @relation("PoolToken1")

  // Indexes for efficient queries
  @@index([tokenType])
  @@index([symbol])
  @@index([coingeckoId])
}

model Pool {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  protocol  String   // 'uniswapv3', etc.
  poolType  String   // 'CL_TICKS'
  token0Id  String
  token1Id  String
  feeBps    Int      // Fee in basis points

  config    Json     // Pool-specific config (immutable)
  state     Json     // Pool state (mutable, updated frequently)

  // Relations
  token0    Token    @relation("PoolToken0", fields: [token0Id], references: [id])
  token1    Token    @relation("PoolToken1", fields: [token1Id], references: [id])

  @@index([protocol])
  @@index([poolType])
  @@index([token0Id])
  @@index([token1Id])
}
```

**Benefits:**
- ✅ **Schema flexibility**: Add new platforms without database migrations
- ✅ **Query capability**: PostgreSQL JSON operators allow efficient queries
- ✅ **Type safety**: TypeScript ensures correctness at compile time
- ✅ **Performance**: JSON fields are indexed and performant in Postgres
- ✅ **Future-proof**: Easy to add new chains (Arbitrum, Polygon, etc.)

**BigInt Handling:**
For numeric values that exceed JavaScript's `Number.MAX_SAFE_INTEGER` (like Uniswap V3's sqrtPriceX96):
- **TypeScript**: Use native `bigint` type
- **Database**: Store as `string` in JSON fields
- **Conversion**: Service layer handles `bigint` ↔ `string` conversion

Example:
```typescript
// TypeScript type
interface UniswapV3PoolState {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  currentTick: number;
}

// Database serialization
interface UniswapV3PoolStateDB {
  sqrtPriceX96: string;  // "1234567890123456789"
  liquidity: string;
  currentTick: number;
}

// Conversion functions in service layer
function toPoolState(db: UniswapV3PoolStateDB): UniswapV3PoolState {
  return {
    sqrtPriceX96: BigInt(db.sqrtPriceX96),
    liquidity: BigInt(db.liquidity),
    currentTick: db.currentTick,
  };
}
```

### Extensibility

Adding support for a new **EVM chain** (like Arbitrum, Base, Polygon):

**Already supported!** All EVM chains use the same `Erc20TokenConfig`:
```typescript
// Works for any EVM chain - just change chainId
const usdcArbitrum: Erc20Token = {
  tokenType: 'evm-erc20',
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  config: {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    chainId: 42161  // Arbitrum
  }
};
```

Adding a **new blockchain ecosystem** (non-EVM, non-Solana):

1. **Define the config interface**:
```typescript
interface CosmosTokenConfig {
  denom: string;  // Cosmos denomination
  chainId: string; // e.g., "cosmoshub-4"
}
```

2. **Add to union type**:
```typescript
type TokenConfig =
  | Erc20TokenConfig
  | SolanaTokenConfig
  | CosmosTokenConfig;
```

3. **Update discriminator**:
```typescript
type TokenType = 'evm-erc20' | 'solana-spl' | 'cosmos-native';
```

4. **Create type alias**:
```typescript
type CosmosToken = Token<CosmosTokenConfig>;
```

**No database migration needed!** The JSON field and indexes accommodate the new structure immediately.

## Package Organization

Midcurve Finance is organized into two complementary packages:

### @midcurve/shared (Separate Repository)

**Repository:** `../midcurve-shared/`

A standalone TypeScript package containing:
- **Types**: All shared type definitions (Token, Pool, Position, etc.)
- **Utilities**: Pure utility functions
  - EVM address utilities (validation, normalization, comparison)
  - UniswapV3 calculations (price, liquidity, position math)
  - Mathematical helpers

**Purpose:**
- Consumed by all Midcurve projects (API, UI, Workers, Services)
- Zero dependencies on databases or services
- Framework-agnostic (works in Node.js, browser, edge runtimes)
- Independently versioned and published to npm

**Installation:**
```bash
npm install @midcurve/shared
```

**Usage:**
```typescript
import { Token, Erc20Token, normalizeAddress, sqrtPriceX96ToPrice } from '@midcurve/shared';
```

### @midcurve/services (This Repository)

Contains:
- **Services**: Business logic and CRUD operations (requires Prisma)
- **Config**: Chain configuration and RPC management
- **Clients**: External API clients (CoinGecko, Etherscan, Subgraphs)
- **Service-specific utilities**: ERC-20 contract readers, APR calculations
- **Database schema**: Prisma models and migrations

**Dependency:**
```json
{
  "dependencies": {
    "@midcurve/shared": "file:../midcurve-shared"
  }
}
```

**Key Difference:**
- `@midcurve/shared` = Pure types + utilities (no DB, no services)
- `@midcurve/services` = Business logic + DB operations (consumes shared)

## Project Structure

```
midcurve-services/
├── src/
│   ├── cache/                     # Distributed caching layer
│   │   ├── cache-service.ts       # PostgreSQL-based cache
│   │   ├── cache-service.test.ts  # Cache tests
│   │   └── index.ts               # Barrel exports
│   │
│   ├── config/                    # Configuration layer
│   │   ├── evm.ts                 # EVM chain configuration
│   │   ├── evm.test.ts            # Config tests
│   │   └── index.ts               # Barrel exports
│   │
│   ├── clients/                   # External API clients
│   │   └── coingecko/             # CoinGecko API client
│   │       ├── coingecko-client.ts                      # API client with distributed caching
│   │       ├── coingecko-client.integration.test.ts     # Integration tests
│   │       └── index.ts
│   │
│   ├── services/                  # Business logic layer
│   │   ├── token/                 # Token management
│   │   │   ├── token-service.ts              # Base CRUD service
│   │   │   ├── erc20-token-service.ts        # ERC-20 specialized service
│   │   │   ├── erc20-token-service.test.ts   # ERC-20 service tests
│   │   │   ├── test-fixtures.ts              # Test data
│   │   │   ├── token-service.test.ts         # Unit tests
│   │   │   └── index.ts
│   │   │
│   │   └── types/                 # Service-layer types (DB only)
│   │       ├── token/             # Token input types
│   │       │   ├── token-input.ts        # Create/Update inputs
│   │       │   └── index.ts
│   │       ├── pool/              # Pool input types
│   │       │   ├── pool-input.ts         # Create/Update inputs
│   │       │   └── index.ts
│   │       ├── uniswapv3/         # Protocol DB types
│   │       │   ├── pool-db.ts            # DB serialization
│   │       │   └── index.ts
│   │       └── index.ts
│   │
│   ├── utils/                     # Service-specific utilities
│   │   ├── evm/                   # EVM utilities (services-specific)
│   │   │   ├── erc20-abi.ts           # Minimal ERC-20 ABI
│   │   │   ├── erc20-reader.ts        # Contract metadata reader
│   │   │   ├── erc20-reader.test.ts   # Reader tests
│   │   │   └── index.ts
│   │   ├── apr/                   # APR calculation utilities
│   │   └── request-scheduler/     # Rate limiting utilities
│   │
│   └── index.ts                   # Main entry point
│
├── prisma/
│   └── schema.prisma              # Database schema (PostgreSQL)
│
├── .env.example                   # Environment variables template
├── vitest.config.ts               # Test configuration
├── package.json                   # ESM, Next.js/Vercel compatible
└── tsconfig.json                  # Strict TypeScript config
```

### Directory Organization

**Note:** Shared types and utilities are now in the `@midcurve/shared` package (separate repository).

**`src/cache/`** - Distributed caching layer
- PostgreSQL-based cache service
- Shared cache across all workers/processes/serverless functions
- TTL-based expiration, graceful error handling

**`src/config/`** - Configuration layer
- EVM chain configuration (RPC URLs, public clients)
- Centralized config management
- Environment-based setup

**`src/clients/`** - External API clients
- CoinGecko API client with distributed caching
- Future: Other external data sources

**`src/services/`** - Business logic and CRUD operations
- Token management (create, read, update, delete, discover)
- Future: Pool management, position tracking, risk calculations

**`src/services/types/`** - Service-layer specific types
- Database operation types (CreateInput, UpdateInput)
- NOT shared with UI/API (they don't have DB access)
- DB serialization types (e.g., bigint → string)

**`src/utils/`** - Service-specific utility functions
- ERC-20 contract readers (requires viem and RPC access)
- APR calculation utilities (requires position history data)
- Request scheduling and rate limiting (for external APIs)
- Note: Core utilities (address validation, math) are in `@midcurve/shared`

## Technology Stack

- **Language**: TypeScript 5.3+ (strict mode, ESM)
- **Runtime**: Node.js 18+
- **Database**: PostgreSQL with Prisma ORM 5.7+
- **Module System**: ES Modules (Next.js/Vercel compatible)
- **Package Manager**: npm/pnpm/yarn
- **Testing**: Vitest 3.2+ (fast, native ESM support)
- **Libraries**:
  - `viem` 2.38+ - Ethereum utilities, EIP-55 checksumming
  - `vitest-mock-extended` 3.1+ - Type-safe Prisma mocking

## Service Layer Architecture

### TokenService (Base Service)

Generic token management service that handles any token type (ERC-20, Solana SPL, etc.).

**Key Features:**
- Generic `create()` method accepting `CreateAnyTokenInput`
- Returns `AnyToken` with full type information
- Dependency injection for testability
- Prisma client management

**Usage:**
```typescript
import { TokenService } from '@midcurve/services';

const service = new TokenService({ prisma });

const token = await service.create({
  tokenType: 'evm-erc20',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  config: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1
  }
});
```

### Erc20TokenService (Specialized Service)

ERC-20 specific service with address validation, normalization, and duplicate prevention.

**Key Features:**
- **Address Validation**: Validates format (0x + 40 hex characters)
- **Address Normalization**: Converts to EIP-55 checksum format
- **Duplicate Prevention**: Checks for existing token by address + chainId
- **Type Safeguards**: Ensures only ERC-20 tokens in all operations

**Full CRUD Operations:**

```typescript
import { Erc20TokenService } from '@midcurve/services';

const service = new Erc20TokenService({ prisma });

// CREATE - Returns existing if duplicate found
const usdc = await service.create({
  tokenType: 'evm-erc20',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  config: {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // any case
    chainId: 1
  }
});
// Address automatically normalized to: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

// READ by address and chain
const token = await service.findByAddressAndChain(
  '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48', // any case works
  1
);

// READ by ID
const tokenById = await service.findById('token_123');

// UPDATE
const updated = await service.update('token_123', {
  logoUrl: 'https://example.com/usdc.png',
  marketCap: 28000000000
});

// DELETE
await service.delete('token_123');
```

**How Duplicate Prevention Works:**
```typescript
// First call creates the token
const token1 = await service.create({
  tokenType: 'evm-erc20',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  config: { address: '0xa0b8...', chainId: 1 }
});

// Second call with same address+chainId returns existing token
const token2 = await service.create({
  tokenType: 'evm-erc20',
  name: 'USD Coin (duplicate)', // Different name
  symbol: 'USDC',
  decimals: 6,
  config: { address: '0xA0B8...', chainId: 1 } // Same address (any case)
});

// token1.id === token2.id (same token returned)
```

### Service Type Separation

**Why separate service types from shared types?**

Service layer types (`CreateTokenInput`, `UpdateTokenInput`) are **not shared** with UI/API because:
1. UI/API don't have direct database access
2. They receive fully populated objects (with id, timestamps)
3. Clear architectural boundaries

**Service Types:**
```typescript
// src/services/types/token/token-input.ts

// For creating tokens (omits DB-generated fields)
type CreateTokenInput<TConfig> = Omit<
  Token<TConfig>,
  'id' | 'createdAt' | 'updatedAt'
>;

// For updating tokens (partial, omits immutable fields)
type UpdateTokenInput<TConfig> = Partial<
  Omit<Token<TConfig>, 'id' | 'tokenType' | 'createdAt' | 'updatedAt'>
>;

// Platform-specific aliases
type CreateErc20TokenInput = CreateTokenInput<Erc20TokenConfig>;
type UpdateErc20TokenInput = UpdateTokenInput<Erc20TokenConfig>;
```

**Shared Types:**
```typescript
// src/shared/types/token.ts

// Full token interface (consumed by UI/API/Workers)
interface Token<TConfig> {
  id: string;              // Present in shared types
  createdAt: Date;         // Present in shared types
  updatedAt: Date;         // Present in shared types
  tokenType: TokenType;
  name: string;
  symbol: string;
  // ... other fields
}
```

## EVM Utilities

### Address Operations (`src/utils/evm.ts`)

Essential utilities for working with Ethereum addresses.

#### `isValidAddress(address: string): boolean`

Validates Ethereum address format using regex.

```typescript
import { isValidAddress } from '@midcurve/services';

isValidAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'); // true
isValidAddress('0x123'); // false (too short)
isValidAddress('invalid'); // false (no 0x prefix)
```

**Validation Rules:**
- Must start with `0x`
- Exactly 40 hexadecimal characters after `0x`
- Case-insensitive check

#### `normalizeAddress(address: string): string`

Converts address to EIP-55 checksum format using viem's `getAddress()`.

```typescript
import { normalizeAddress } from '@midcurve/services';

const normalized = normalizeAddress('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
// Returns: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

// Throws error for invalid addresses
normalizeAddress('invalid'); // Error: Invalid Ethereum address
```

**Why Normalization Matters:**
- Prevents duplicate database entries (lowercase vs mixed case)
- Ensures consistent address format
- EIP-55 checksumming detects typos
- Required for efficient database queries

#### `compareAddresses(addressA: string, addressB: string): number`

Deterministic ordering of addresses using BigInt comparison.

```typescript
import { compareAddresses } from '@midcurve/services';

const addr1 = '0x0000000000000000000000000000000000000001';
const addr2 = '0x0000000000000000000000000000000000000002';

compareAddresses(addr1, addr2); // -1 (addr1 < addr2)
compareAddresses(addr2, addr1); // 1 (addr2 > addr1)
compareAddresses(addr1, addr1); // 0 (equal)

// Case-insensitive (normalizes before comparing)
const lower = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const upper = '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48';
compareAddresses(lower, upper); // 0 (same address)
```

**Use Cases:**
- Sorting token lists
- Ensuring canonical token ordering (token0 < token1)
- Binary search algorithms

### Why viem?

We use `viem` for EIP-55 checksumming instead of web3.js or ethers.js because:
- ✅ **Lightweight**: Only imports what you need (tree-shakeable)
- ✅ **Modern**: Native TypeScript, ESM-first
- ✅ **Fast**: Optimized for performance
- ✅ **Type-safe**: Excellent TypeScript support
- ✅ **Maintained**: Active development and community

## Testing Infrastructure

### Testing Strategy

**Philosophy:**
- **Unit tests** for business logic
- **Mock external dependencies** (Prisma, network calls)
- **Fast feedback loop** (no database required)
- **Type-safe mocks** using vitest-mock-extended

**Tools:**
- **Vitest** - Fast, modern test framework with native ESM support
- **vitest-mock-extended** - Type-safe mocking for Prisma and other dependencies
- **Node environment** - No jsdom/browser emulation needed

### Test Coverage

**Current Status:**
- ✅ **121 tests passing**
- ✅ **Execution time**: ~350ms
- ✅ **Coverage**:
  - EVM utilities: 25 tests (100% coverage)
  - EVM configuration: 23 tests (100% coverage)
  - ERC-20 reader: 22 tests (100% coverage)
  - TokenService: 36 tests (100% coverage of create method)
  - Erc20TokenService: 15 tests (100% coverage of discoverToken method)

**Test Distribution:**
```
src/utils/evm.test.ts                        25 tests    7ms
src/utils/erc20-reader.test.ts               22 tests    6ms
src/config/evm.test.ts                       23 tests    7ms
src/services/token/token-service.test.ts     36 tests   13ms
src/services/token/erc20-token-service.test.ts 15 tests   9ms
```

### Test Fixtures Pattern

Reusable test data library for consistent, realistic testing.

**Fixture Structure:**
```typescript
// src/services/token/test-fixtures.ts

interface TokenFixture {
  input: CreateAnyTokenInput;   // For service.create()
  dbResult: {                   // For mock return value
    id: string;
    createdAt: Date;
    updatedAt: Date;
    // ... all token fields
  };
}

export const USDC_ETHEREUM: TokenFixture = {
  input: {
    tokenType: 'evm-erc20',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    config: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1
    }
  },
  dbResult: {
    id: 'token_usdc_eth_001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    // ... matches input with DB fields
  }
};
```

**Available Fixtures:**
- **ERC-20**: USDC (Ethereum, Arbitrum, Base), WETH, DAI
- **Solana**: Wrapped SOL, USDC (with programId)
- **Edge Cases**: Minimal token, special characters, zero/high decimals, zero marketCap

**Usage in Tests:**
```typescript
import { USDC_ETHEREUM } from './test-fixtures';

it('should create USDC on Ethereum', async () => {
  prismaMock.token.create.mockResolvedValue(USDC_ETHEREUM.dbResult);

  const result = await tokenService.create(USDC_ETHEREUM.input);

  expect(result.symbol).toBe('USDC');
});
```

**Helper for Custom Fixtures:**
```typescript
import { createTokenFixture } from './test-fixtures';

const customToken = createTokenFixture({
  symbol: 'CUSTOM',
  config: { address: '0x...', chainId: 999 }
});
```

### Running Tests

```bash
# Watch mode (interactive)
npm test

# Single run (CI/CD)
npm run test:run

# With coverage report
npm run test:coverage
```

### Writing Tests

**Test Structure (Arrange-Act-Assert):**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('TokenService', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;
  let tokenService: TokenService;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    tokenService = new TokenService({ prisma: prismaMock });
  });

  it('should create token successfully', async () => {
    // Arrange
    const input = { tokenType: 'evm-erc20', /* ... */ };
    prismaMock.token.create.mockResolvedValue(mockDbResult);

    // Act
    const result = await tokenService.create(input);

    // Assert
    expect(result.symbol).toBe('USDC');
    expect(prismaMock.token.create).toHaveBeenCalledTimes(1);
  });
});
```

**Benefits:**
- ✅ Fast execution (no database I/O)
- ✅ Isolated tests (no side effects)
- ✅ Deterministic results (mocked data)
- ✅ Type-safe mocks
- ✅ Clear test organization

## Architecture Decisions

### Why Dependency Injection?

**Pattern:**
```typescript
class Erc20TokenService {
  constructor(dependencies: { prisma?: PrismaClient } = {}) {
    this.prisma = dependencies.prisma ?? new PrismaClient();
  }
}
```

**Benefits:**
- ✅ **Testability**: Inject mock Prisma client in tests
- ✅ **Flexibility**: Use different Prisma instances (read replicas, etc.)
- ✅ **Control**: Explicit dependency management
- ✅ **Optional**: Defaults provided for convenience

### Why Specialized Services?

Instead of one monolithic service, we have:
- **Base service** (`TokenService`) - Generic operations, all token types
- **Specialized services** (`Erc20TokenService`) - Platform-specific logic

**Benefits:**
- ✅ **Separation of concerns**: ERC-20 logic separate from Solana logic
- ✅ **Type safety**: Specialized services enforce correct types
- ✅ **DRY principle**: Base service provides common functionality
- ✅ **Extensibility**: Easy to add new platform services

### Why Address Normalization?

Without normalization:
```typescript
// These would be treated as different tokens!
'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
'0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48'
```

With normalization:
```typescript
// All normalized to same format
normalizeAddress('0xa0b8...') // 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
normalizeAddress('0xA0B8...') // 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

// Database queries work regardless of case
service.findByAddressAndChain('0xA0B8...', 1); // ✅ Found
```

**Benefits:**
- ✅ Prevents duplicate entries
- ✅ Consistent storage format
- ✅ Efficient queries
- ✅ EIP-55 checksum validation

### Why Separate Service Types?

**Architecture:**
```
UI/API (consumers)
    ↓
    Uses: Token<TConfig> (with id, timestamps)

Service Layer
    ↓
    Uses: CreateTokenInput (without id, timestamps)
    ↓
Database (Prisma)
```

**Rationale:**
- UI/API receive **complete objects** (with id, timestamps)
- Service layer creates **incomplete objects** (omits DB-generated fields)
- Clear boundary between layers
- Type safety at compile time

### Why PostgreSQL for Caching (Not Redis)?

Midcurve Services uses **PostgreSQL** as the distributed cache backend instead of Redis.

**The Problem:**
- CoinGecko free API has strict rate limits (~30 calls/minute)
- Multiple workers/processes/serverless functions need to share cache
- In-memory singleton cache doesn't work across process boundaries
- Need cache that survives deployments and restarts

**Why PostgreSQL Instead of Redis:**

✅ **Already Available**: PostgreSQL is already running in all environments (dev, test, production)
✅ **No New Infrastructure**: No additional service to deploy, manage, or pay for
✅ **Persistent Cache**: Cache survives application restarts, deployments, and server reboots
✅ **Lower Total Cost**: No Redis hosting fees (Upstash, Redis Labs, etc.)
✅ **Good Enough Performance**: 3ms vs 1ms cache lookup is irrelevant when replacing 200-500ms+ API calls
✅ **Type-Safe with Prisma**: Leverage existing Prisma client and type system
✅ **ACID Guarantees**: Transactions and consistency built-in
✅ **Version Controlled Schema**: Cache table managed via Prisma migrations

**Performance Analysis:**
- PostgreSQL cache lookup: ~1-5ms
- Redis cache lookup: ~0.1-1ms
- CoinGecko API call: ~200-500ms+
- **Conclusion**: Cache speed difference is negligible compared to API call savings

**When Would Redis Be Better?**
Redis would only be preferable if:
- Cache reads > 10,000/second (not our use case)
- Sub-millisecond latency critical (it's not for API caching)
- Ephemeral cache desired (we want persistent)
- Already using Redis for other features (we're not)

## Distributed Caching Architecture

### Overview

Midcurve Services implements a **PostgreSQL-based distributed cache** that enables cache sharing across:
- Multiple Vitest test workers (parallel test execution)
- Multiple API instances (horizontal scaling on Vercel)
- Multiple background workers (Node.js processes)
- Multiple serverless functions (Vercel Functions)
- Development and production environments

### Cache Service

The `CacheService` provides a generic, type-safe caching layer using PostgreSQL as the backend.

**Key Features:**
- TTL-based expiration (configurable per cache entry)
- Automatic expired entry cleanup
- Graceful error handling (cache failures don't break the application)
- Type-safe value storage and retrieval
- Pattern-based cache clearing
- Singleton pattern with dependency injection

**Database Schema:**
```prisma
model Cache {
  key       String   @id
  value     Json
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([expiresAt])
}
```

**Cache Operations:**
```typescript
import { CacheService } from '@midcurve/services';

const cache = CacheService.getInstance();

// Set with TTL
await cache.set('my-key', { data: 'value' }, 3600); // 1 hour

// Get (returns null if not found or expired)
const data = await cache.get<MyType>('my-key');

// Delete
await cache.delete('my-key');

// Clear pattern (e.g., all CoinGecko cache)
await cache.clear('coingecko:');

// Cleanup expired entries (run periodically)
const deleted = await cache.cleanup();

// Get statistics
const stats = await cache.getStats();
// { totalEntries: 100, expiredEntries: 15, activeEntries: 85 }
```

### CoinGecko Client Caching

The `CoinGeckoClient` uses `CacheService` to dramatically reduce API calls and avoid rate limiting.

**Cache Keys:**
- `coingecko:tokens:all` - Full token list (1-hour TTL)
- `coingecko:coin:{coinId}` - Individual coin details (1-hour TTL)

**Benefits:**
- 80-90% reduction in CoinGecko API calls
- No rate limiting issues in production
- Faster response times (3ms cache vs 200-500ms API)
- Cache shared across all workers/processes
- Cache persists across deployments

**Usage:**
```typescript
import { CoinGeckoClient } from '@midcurve/services';

const client = CoinGeckoClient.getInstance();

// First call: Fetches from API, stores in PostgreSQL cache
const tokens1 = await client.getAllTokens(); // ~500ms

// Second call (from any worker/process): Returns from cache
const tokens2 = await client.getAllTokens(); // ~3ms

// Even after redeploying the app, cache persists
// No need to warm cache after deployments
```

### Integration Testing with Shared Cache

Integration tests demonstrate the cache working across multiple test files:

**Before (In-Memory Cache):**
```
Test File 1 (Worker 1)     Test File 2 (Worker 2)
     ↓                           ↓
CoinGeckoClient               CoinGeckoClient
Instance #1                   Instance #2
Memory Cache #1               Memory Cache #2
     ↓                           ↓
API Call #1                   API Call #2  ← Rate limit!
API Call #3                   API Call #4  ← Rate limit!
```

**After (PostgreSQL Cache):**
```
Test File 1 (Worker 1)     Test File 2 (Worker 2)
     ↓                           ↓
CoinGeckoClient               CoinGeckoClient
Instance #1                   Instance #2
     ↓                           ↓
     └─────────┬─────────────────┘
               ↓
        PostgreSQL Cache
               ↓
        API Call #1 only!
      (All others use cache)
```

**Test Results:**
- 29/29 tests pass
- Minimal rate limiting warnings
- Tests share cached data across workers
- Much faster test execution

### Cache Management in Production

**Automatic Expiration:**
- Expired entries automatically excluded from reads
- Lazy deletion on next access
- Optional periodic cleanup job

**Manual Cache Clearing:**
```typescript
// Clear all CoinGecko cache
await client.clearCache();

// Clear specific patterns via CacheService
const cache = CacheService.getInstance();
await cache.clear('coingecko:coin:'); // Clear only coin details
```

**Monitoring:**
```typescript
const cache = CacheService.getInstance();
const stats = await cache.getStats();

console.log(`
  Total cache entries: ${stats.totalEntries}
  Active entries: ${stats.activeEntries}
  Expired entries: ${stats.expiredEntries}
`);
```

**Periodic Cleanup (Optional):**
```typescript
// In a cron job or scheduled task
import { CacheService } from '@midcurve/services';

const cache = CacheService.getInstance();
const deleted = await cache.cleanup();
console.log(`Cleaned up ${deleted} expired cache entries`);
```

### Production Deployment Considerations

**Vercel Serverless:**
- Each serverless function connects to same PostgreSQL database
- Cache automatically shared across all function invocations
- No Redis infrastructure needed
- Cache persists between cold starts

**Traditional Node.js (PM2, Docker, etc.):**
- Multiple Node processes share cache via PostgreSQL
- Connection pooling handled by Prisma
- Horizontal scaling works out of the box

**Database Considerations:**
- Cache table grows over time (plan for cleanup or TTL cleanup job)
- PostgreSQL JSONB indexing makes queries fast
- Consider partitioning Cache table if it exceeds millions of entries

### Future Enhancements

**Cache Warming (Optional):**
```typescript
// Warm cache on application startup
import { CoinGeckoClient } from '@midcurve/services';

async function warmCache() {
  const client = CoinGeckoClient.getInstance();
  await client.getAllTokens(); // Warm token list cache
}
```

**Cache Statistics API (Optional):**
```typescript
// Expose cache statistics via API endpoint
app.get('/api/admin/cache/stats', async (req, res) => {
  const cache = CacheService.getInstance();
  const stats = await cache.getStats();
  res.json(stats);
});
```

**Cache Invalidation API (Optional):**
```typescript
// Manually invalidate cache via admin endpoint
app.post('/api/admin/cache/clear', async (req, res) => {
  const cache = CacheService.getInstance();
  const deleted = await cache.clear('coingecko:');
  res.json({ deleted });
});
```

## Future Roadmap

### ✅ Phase 1: Extract Shared Types (COMPLETED)
The `src/shared` directory has been successfully extracted into a separate repository (`@midcurve/shared`) and is now consumed as an independent package by all projects.

**Completed:**
- Created `@midcurve/shared` package with types and utilities
- Migrated EVM address utilities and UniswapV3 math functions
- Updated all import paths in `@midcurve/services`
- All tests passing (107 tests in shared, 645 tests in services)

### Phase 2: Service Layer Implementation
Implement core services:
- Position tracking and monitoring
- Risk calculation algorithms
- Automated rebalancing strategies
- Fee collection optimization
- Impermanent loss tracking

### Phase 3: Multi-Platform Support
Expand to additional platforms:
- Arbitrum (Uniswap V3)
- Polygon (QuickSwap, Uniswap V3)
- Optimism (Velodrome, Uniswap V3)
- Additional Solana DEXs

### Phase 4: Advanced Features
- Machine learning for optimal rebalancing
- Historical performance analytics
- Gas optimization strategies
- Cross-chain position management

## EVM Configuration

### Overview

Midcurve Services includes a centralized EVM configuration system (`EvmConfig`) that manages RPC endpoints, public clients, and chain metadata for all supported EVM chains.

This system enables:
- **Token Discovery**: Automatically read token metadata from contracts
- **On-Chain Queries**: Fetch pool state, position data, and more
- **Multi-Chain Support**: Seamlessly work with Ethereum, Arbitrum, Base, BSC, Polygon, and Optimism
- **Environment-Based Config**: Configure RPC endpoints via environment variables

### Environment Configuration

**IMPORTANT:** RPC URL environment variables are **REQUIRED**. The application will throw an error at runtime if you attempt to use a chain without its RPC URL configured.

Create a `.env` file in your project root (use `.env.example` as a template):

```bash
# Ethereum Mainnet (Chain ID: 1) - REQUIRED
RPC_URL_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Arbitrum One (Chain ID: 42161) - REQUIRED
RPC_URL_ARBITRUM=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Base (Chain ID: 8453) - REQUIRED
RPC_URL_BASE=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# BNB Smart Chain (Chain ID: 56) - REQUIRED
RPC_URL_BSC=https://bsc-dataseed1.binance.org

# Polygon (Chain ID: 137) - REQUIRED
RPC_URL_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Optimism (Chain ID: 10) - REQUIRED
RPC_URL_OPTIMISM=https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

**Note:** You only need to configure RPC URLs for chains you plan to use. If you attempt to access an unconfigured chain, you'll receive a comprehensive error message with setup instructions.

### Supported Chains

| Chain | Chain ID | Environment Variable |
|-------|----------|---------------------|
| Ethereum | 1 | `RPC_URL_ETHEREUM` |
| Arbitrum One | 42161 | `RPC_URL_ARBITRUM` |
| Base | 8453 | `RPC_URL_BASE` |
| BNB Smart Chain | 56 | `RPC_URL_BSC` |
| Polygon | 137 | `RPC_URL_POLYGON` |
| Optimism | 10 | `RPC_URL_OPTIMISM` |

### Usage

#### Basic Configuration Access

```typescript
import { EvmConfig, SupportedChainId } from '@midcurve/services';

// Get singleton instance
const config = EvmConfig.getInstance();

// Check if chain is supported
if (config.isChainSupported(SupportedChainId.ETHEREUM)) {
  console.log('Ethereum is supported!');
}

// Get chain configuration
const ethConfig = config.getChainConfig(SupportedChainId.ETHEREUM);
console.log(ethConfig);
// {
//   chainId: 1,
//   name: 'Ethereum',
//   rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/...',
//   blockExplorer: 'https://etherscan.io',
//   viemChain: {...}
// }

// Get all supported chain IDs
const chains = config.getSupportedChainIds();
// [1, 42161, 8453, 56, 137, 10]
```

#### Using Public Clients

```typescript
import { EvmConfig } from '@midcurve/services';

const config = EvmConfig.getInstance();

// Get viem PublicClient for Ethereum
const client = config.getPublicClient(1);

// Use client for on-chain queries
const blockNumber = await client.getBlockNumber();
console.log(`Latest block: ${blockNumber}`);

// Read from a contract
const balance = await client.readContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: ['0x...'],
});
```

**Note:** Public clients are **cached per chain** for performance. Subsequent calls to `getPublicClient(chainId)` return the same instance.

### Token Discovery

The `Erc20TokenService.discoverToken()` method uses `EvmConfig` to automatically discover and save tokens from on-chain contract data.

#### How It Works

1. **Check Database**: First checks if token already exists (avoids RPC call)
2. **Validate Chain**: Ensures the chain ID is supported
3. **Read Contract**: Uses multicall to efficiently read `name()`, `symbol()`, `decimals()`
4. **Save to Database**: Creates token entry with discovered metadata
5. **Return Token**: Returns the fully populated `Erc20Token`

#### Example Usage

```typescript
import { Erc20TokenService } from '@midcurve/services';

const service = new Erc20TokenService();

// Discover USDC on Ethereum
const usdc = await service.discoverToken(
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  1
);

console.log(usdc);
// {
//   id: 'token_...',
//   tokenType: 'evm-erc20',
//   name: 'USD Coin',
//   symbol: 'USDC',
//   decimals: 6,
//   config: {
//     address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
//     chainId: 1
//   },
//   createdAt: Date,
//   updatedAt: Date
// }

// Discover token on Arbitrum
const arbUsdc = await service.discoverToken(
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  42161
);
```

#### Idempotent Discovery

`discoverToken()` is **idempotent** - calling it multiple times with the same address/chain returns the existing token without making RPC calls:

```typescript
// First call: Reads from contract, saves to DB
const token1 = await service.discoverToken('0xA0b8...', 1);

// Second call: Returns existing token from DB (no RPC call)
const token2 = await service.discoverToken('0xA0b8...', 1);

// Same token
assert(token1.id === token2.id);
```

#### Error Handling

```typescript
try {
  await service.discoverToken('0x...', 1);
} catch (error) {
  if (error instanceof TokenMetadataError) {
    // Contract doesn't implement ERC-20 metadata
    console.error('Not a valid ERC-20 token');
  } else if (error.message.includes('Chain')) {
    // Unsupported chain
    console.error('Chain not configured');
  } else {
    // Other errors (network, etc.)
    console.error('Discovery failed:', error);
  }
}
```

### Dependency Injection

For testing, you can inject a custom `EvmConfig` instance:

```typescript
import { Erc20TokenService, EvmConfig } from '@midcurve/services';

// Custom config (e.g., for testing)
const customConfig = new EvmConfig();

const service = new Erc20TokenService({
  evmConfig: customConfig,
});
```

### Architecture Benefits

1. **Single Source of Truth**: All RPC configuration in one place
2. **Environment-Based**: Different RPC endpoints per environment (dev/staging/prod)
3. **Efficient Caching**: Public clients reused across the application
4. **Type-Safe**: Leverages viem's typed clients and ABIs
5. **Testable**: Easy to mock in unit tests
6. **Extensible**: Add new chains without breaking existing code

## Development Philosophy

1. **Type Safety First**: Leverage TypeScript's type system for correctness
2. **Platform Agnostic**: Abstract interfaces over concrete implementations
3. **Testability**: Business logic should be easily testable
4. **Documentation**: Code should be self-documenting with clear types
5. **Performance**: Optimize for production use at scale
6. **Extensibility**: Easy to add new platforms and features

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your RPC URLs

# Generate Prisma client
npm run prisma:generate

# Build the project
npm run build

# Run in development mode (watch)
npm run dev

# Run tests
npm test                # Watch mode
npm run test:run        # Single run
npm run test:coverage   # With coverage

# Type checking (without build)
npm run type-check
```

## Integration Example

### In API/UI/Workers Projects (Using @midcurve/shared)

```typescript
// Import shared types and utilities from @midcurve/shared
import {
  Token,
  Erc20Token,
  AnyToken,
  Erc20TokenConfig,
  normalizeAddress,
  sqrtPriceX96ToPrice,
} from '@midcurve/shared';

// Use the shared types
function processToken(token: AnyToken) {
  console.log(`Processing ${token.symbol}`);

  // Type narrowing with discriminated unions
  if (token.tokenType === 'evm-erc20') {
    console.log(`ERC-20 on chain ${token.config.chainId}`);
  } else {
    console.log(`SPL token: ${token.config.mint}`);
  }
}

// Type-safe platform-specific handling
function getExplorerUrl(token: Erc20Token): string {
  const baseUrls: Record<number, string> = {
    1: 'https://etherscan.io',
    42161: 'https://arbiscan.io',
    8453: 'https://basescan.org',
  };

  const baseUrl = baseUrls[token.config.chainId];
  return `${baseUrl}/token/${token.config.address}`;
}
```

### In Service Layer (Server-Side Only - Using @midcurve/services)

```typescript
// Import shared types and utilities from @midcurve/shared
import {
  Token,
  Erc20Token,
  normalizeAddress,
  isValidAddress,
} from '@midcurve/shared';

// Import services from @midcurve/services
import {
  TokenService,
  Erc20TokenService,
  type CreateErc20TokenInput,
} from '@midcurve/services';

// Use services
const erc20Service = new Erc20TokenService({ prisma });

const usdc = await erc20Service.create({
  tokenType: 'evm-erc20',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  config: {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    chainId: 1,
  },
});

// Use utilities
if (isValidAddress(userInputAddress)) {
  const normalized = normalizeAddress(userInputAddress);
  // Store normalized address in database
}
```

---

**Midcurve Finance** - Professional risk management for concentrated liquidity providers
