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
┌─────────────────────────────────────────────────┐
│         Midcurve Finance Ecosystem              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐  │
│  │   API   │  │    UI    │  │   Workers    │  │
│  │ (Vercel)│  │ (Next.js)│  │  (Node.js)   │  │
│  └────┬────┘  └─────┬────┘  └──────┬───────┘  │
│       │             │               │          │
│       └─────────────┴───────────────┘          │
│                     │                          │
│            ┌────────▼─────────┐                │
│            │ Midcurve Services│                │
│            │  (This Project)  │                │
│            └──────────────────┘                │
│                     │                          │
│            ┌────────▼─────────┐                │
│            │    PostgreSQL     │                │
│            │   (Prisma ORM)    │                │
│            └──────────────────┘                │
│                                                 │
└─────────────────────────────────────────────────┘
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
// Ethereum/BSC tokens
interface EthereumTokenConfig {
  platform: 'ethereum' | 'bsc';
  address: string;  // 0x...
  chainId: number;  // 1, 56, etc.
}

// Solana tokens
interface SolanaTokenConfig {
  platform: 'solana';
  mint: string;      // Base58 pubkey
  programId?: string;
}
```

**Type-Safe Usage**:
```typescript
const ethToken: Token<EthereumTokenConfig> = {
  name: "USDC",
  symbol: "USDC",
  decimals: 6,
  config: {
    platform: 'ethereum',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1
  }
};

const solToken: Token<SolanaTokenConfig> = {
  name: "USDC",
  symbol: "USDC",
  decimals: 6,
  config: {
    platform: 'solana',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  }
};
```

### Database Strategy

The `config` field is persisted as a **PostgreSQL JSON column**:

```prisma
model Token {
  id       String @id
  name     String
  symbol   String
  decimals Int
  config   Json    // Platform-specific data stored as JSON
}
```

**Benefits:**
- ✅ **Schema flexibility**: Add new platforms without database migrations
- ✅ **Query capability**: PostgreSQL JSON operators allow efficient queries
- ✅ **Type safety**: TypeScript ensures correctness at compile time
- ✅ **Performance**: JSON fields are indexed and performant in Postgres
- ✅ **Future-proof**: Easy to add new chains (Arbitrum, Polygon, etc.)

### Extensibility

Adding a new platform is straightforward:

1. **Define the config interface**:
```typescript
interface ArbitrumTokenConfig {
  platform: 'arbitrum';
  address: string;
  chainId: 42161;
}
```

2. **Add to union type**:
```typescript
type TokenConfig =
  | EthereumTokenConfig
  | SolanaTokenConfig
  | ArbitrumTokenConfig;
```

3. **Create type alias**:
```typescript
type ArbitrumToken = Token<ArbitrumTokenConfig>;
```

**No database migration needed!** The JSON field accommodates the new structure immediately.

## Project Structure

```
midcurve-services/
├── src/
│   ├── shared/              # Shared types (future: separate repo)
│   │   └── types/           # TypeScript interfaces
│   │       ├── token.ts     # Abstract Token interface
│   │       ├── token-config.ts  # Platform configs
│   │       └── index.ts     # Barrel exports
│   │
│   ├── services/            # Business logic layer
│   │   ├── position-service.ts   # CL position management
│   │   ├── risk-service.ts       # Risk calculations
│   │   └── rebalance-service.ts  # Rebalancing logic
│   │
│   └── index.ts             # Main entry point
│
├── prisma/
│   └── schema.prisma        # Database schema (PostgreSQL)
│
├── package.json             # ESM, Next.js/Vercel compatible
└── tsconfig.json            # Strict TypeScript config
```

## Technology Stack

- **Language**: TypeScript (strict mode, ESM)
- **Runtime**: Node.js 18+
- **Database**: PostgreSQL with Prisma ORM
- **Module System**: ES Modules (Next.js/Vercel compatible)
- **Package Manager**: npm/pnpm/yarn

## Future Roadmap

### Phase 1: Extract Shared Types
The `src/shared` directory will be extracted into a separate repository (`@midcurve/shared`) to be consumed as an independent package by all projects.

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

# Generate Prisma client
npm run prisma:generate

# Build the project
npm run build

# Run in development mode
npm run dev
```

## Integration Example

```typescript
// In your API, UI, or Workers project
import { Token, EthereumToken, SolanaToken } from '@midcurve/services';

// Use the shared types
function processToken(token: Token) {
  console.log(`Processing ${token.symbol} on ${token.config.platform}`);
}
```

---

**Midcurve Finance** - Professional risk management for concentrated liquidity providers
