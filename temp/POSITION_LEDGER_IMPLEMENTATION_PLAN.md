# Position Ledger Implementation Plan

## Overview
Implement a comprehensive position ledger system to track PnL, cost basis, and cash flows for concentrated liquidity positions across multiple events (INCREASE_POSITION, DECREASE_POSITION, COLLECT).

## Architecture Components

### 1. **Shared Types** (`src/shared/types/`)
Create type definitions for PositionLedgerEvent that follow the project's abstraction pattern:

- **`position-ledger-event-config.ts`**: Config type maps (similar to `token-config.ts`, `pool-config.ts`)
  - `UniswapV3LedgerEventConfig` interface (chainId, nftId, blockNumber, txIndex, logIndex, txHash, deltaL, liquidityAfter, feesCollected0/1, uncollectedPrincipal0/1After, sqrtPriceX96)
  - `PositionLedgerEventConfigMap` for extensibility

- **`position-ledger-event-state.ts`**: State type maps
  - `UniswapV3LedgerEventState` interface (raw log event data: INCREASE_LIQUIDITY, DECREASE_LIQUIDITY, or COLLECT)
  - `PositionLedgerEventStateMap` for extensibility

- **`position-ledger-event.ts`**: Abstract PositionLedgerEvent interface
  - Generic interface using mapped types: `PositionLedgerEvent<P extends Protocol>`
  - Common fields: id, positionId, protocol, previousId, timestamp, eventType, poolPrice, token0Amount, token1Amount, tokenValue, rewards, deltaCostBasis, costBasisAfter, deltaPnl, pnlAfter, inputHash
  - Protocol-specific: config, state (mapped from PositionLedgerEventConfigMap)
  - Type aliases: `UniswapV3LedgerEvent`, `AnyLedgerEvent`
  - EventType enum: 'INCREASE_POSITION' | 'DECREASE_POSITION' | 'COLLECT'

- **`uniswapv3/position-ledger-event.ts`**: Uniswap V3 specific type aliases

### 2. **Service Layer Types** (`src/services/types/position-ledger/`)
Database-specific types for service operations:

- **`position-ledger-event-input.ts`**:
  - `CreatePositionLedgerEventInput<P>`: Omits id, createdAt, updatedAt
  - `PositionEventDiscoverInput<P>`: Protocol-specific discovery parameters
    - For Uniswap V3: Contains event data from Etherscan/transaction receipt
  - Type aliases: `CreateUniswapV3LedgerEventInput`, `UniswapV3EventDiscoverInput`

- **`uniswapv3/position-ledger-event-db.ts`**:
  - DB serialization types (bigint → string conversion)
  - `UniswapV3LedgerEventConfigDB`, `UniswapV3LedgerEventStateDB`

### 3. **Database Schema** (`prisma/schema.prisma`)
Add PositionLedgerEvent model:

```prisma
model PositionLedgerEvent {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Position reference
  positionId      String
  position        Position @relation(fields: [positionId], references: [id])

  // Protocol and event chaining
  protocol        String
  previousId      String?  // null for first event
  previousEvent   PositionLedgerEvent? @relation("EventChain", fields: [previousId], references: [id])
  nextEvents      PositionLedgerEvent[] @relation("EventChain")

  // Event identification
  timestamp       DateTime
  eventType       String   // 'INCREASE_POSITION', 'DECREASE_POSITION', 'COLLECT'
  inputHash       String   @unique

  // Financial data (stored as string for bigint precision)
  poolPrice       String
  token0Amount    String
  token1Amount    String
  tokenValue      String
  rewards         Json     // Array of {tokenId, tokenAmount, tokenValue}

  // PnL tracking
  deltaCostBasis  String
  costBasisAfter  String
  deltaPnl        String
  pnlAfter        String

  // Protocol-specific data
  config          Json
  state           Json

  // Indexes
  @@index([positionId, timestamp])
  @@index([protocol])
  @@index([eventType])
  @@index([inputHash])
}
```

### 4. **Etherscan Client** (`src/clients/etherscan/`)
Create Etherscan client for fetching position events:

- **`etherscan-client.ts`**: Main client
  - Uses existing `RequestScheduler` and `RetryHandler` utilities
  - Methods: `fetchLogs()`, `fetchContractCreation()`, `getBlockNumberForTimestamp()`
  - Event signatures for INCREASE_LIQUIDITY, DECREASE_LIQUIDITY, COLLECT
  - Rate limit handling with exponential backoff

- **`etherscan-client.test.ts`**: Unit tests with mocked responses

- **`etherscan-client.integration.test.ts`**: Integration tests (rate limit safe)

### 5. **Position Ledger Service** (`src/services/position-ledger/`)

**Base Service: `position-ledger-service.ts`**
- Abstract base class following existing service patterns
- CRUD operations: `findAllItems()`, `addItem()`, `deleteAllItems()` (no insert at arbitrary positions)
- Abstract methods:
  - `parseConfig()`, `serializeConfig()` (config serialization)
  - `parseState()`, `serializeState()` (state serialization)
  - `generateInputHash()` (protocol-specific hash generation)
  - `discoverAllEvents(positionId)`: Fetch complete history from blockchain
  - `discoverEvent(positionId, input)`: Add single event to ledger
- Protected helpers:
  - `mapToLedgerEvent()`: DB result → PositionLedgerEvent mapping
  - `calculateEventFinancials()`: Calculate PnL, cost basis, token values
  - `validateEventSequence()`: Ensure event is after last event, same protocol

**Specialized Service: `uniswapv3-position-ledger-service.ts`**
- Extends PositionLedgerService<'uniswapv3'>
- Implements `discoverAllEvents()`:
  1. Delete existing events for position
  2. Fetch NFPM contract deployment block (cached)
  3. Query Etherscan for all events (INCREASE_LIQUIDITY, DECREASE_LIQUIDITY, COLLECT)
  4. Parse raw log data (32-byte hex chunks)
  5. Deduplicate by inputHash
  6. Sort by (blockNumber, txIndex, logIndex)
  7. Build state sequentially, calculating PnL for each event
  8. Return complete sorted history (descending order by timestamp)

- Implements `discoverEvent()`:
  1. Validate event is after last event in sequence
  2. Validate same protocol
  3. Fetch previous event state
  4. Calculate new state from previous + current event
  5. Save event
  6. Return complete sorted history

- Implements `generateInputHash()`: MD5(positionId + blockNumber + txIndex + logIndex)

- PnL Calculation Logic:
  - **INCREASE_POSITION**: Add to cost basis, no PnL change
  - **DECREASE_POSITION**: Remove proportional cost basis, realize PnL
  - **COLLECT**: Separate fees from uncollected principal, no PnL change

- Fee Separation Logic:
  - Track uncollectedPrincipal0/1 pool
  - On DECREASE: Add amount0/1 to uncollected pool
  - On COLLECT: Pure fees = collected - min(collected, uncollectedPrincipal)

### 6. **Utility Functions** (`src/utils/uniswapv3/`)
Leverage existing utilities and add ledger-specific helpers:

- **`ledger-calculations.ts`**: PnL and cost basis calculations
  - `calculateProportionalCostBasis()`: For DECREASE events
  - `calculateTokenValueInQuote()`: Token amounts → quote value
  - `separateFeesFromPrincipal()`: COLLECT event fee separation
  - `calculatePoolPriceInQuoteToken()`: sqrtPriceX96 → quote price

- **`ledger-calculations.test.ts`**: Comprehensive unit tests

### 7. **Test Infrastructure**

**Unit Tests:**
- `position-ledger-service.test.ts`: Base service tests with mocked Prisma
- `uniswapv3-position-ledger-service.test.ts`: Uniswap V3 specific tests
- `etherscan-client.test.ts`: Client tests with mocked fetch
- `ledger-calculations.test.ts`: Financial calculation tests

**Integration Tests:**
- `uniswapv3-position-ledger-service.integration.test.ts`: Real blockchain data (rate limit safe)
- Test with known position NFT IDs and verify calculations

**Test Fixtures:**
- `test-fixtures.ts`: Reusable test data for events, positions, calculations

## Implementation Order

### **Phase 1: Type Definitions** (✅ COMPLETED)
**Status**: Fully implemented and tested
**Completed**: 2025-01-XX

**What was built:**
- ✅ Protocol-specific config types in `uniswapv3/position-ledger-event-config.ts`
  - `UniswapV3LedgerEventConfig` with all blockchain metadata fields
- ✅ Protocol-specific state types in `uniswapv3/position-ledger-event-state.ts`
  - `UniswapV3IncreaseLiquidityEvent`, `UniswapV3DecreaseLiquidityEvent`, `UniswapV3CollectEvent`
  - Union type `UniswapV3LedgerEventState` with discriminated union
- ✅ Lightweight mapping files:
  - `position-ledger-event-config.ts` - Only contains `PositionLedgerEventConfigMap`
  - `position-ledger-event-state.ts` - Only contains `PositionLedgerEventStateMap`
- ✅ Abstract interface in `position-ledger-event.ts`
  - Generic `PositionLedgerEvent<P>` interface with mapped types
  - `EventType`, `Reward` types
  - Type aliases: `UniswapV3LedgerEvent`, `AnyLedgerEvent`
- ✅ Uniswap V3 convenience types in `uniswapv3/position-ledger-event.ts`
  - Helper types for type narrowing: `UniswapV3IncreaseLedgerEvent`, `UniswapV3DecreaseLedgerEvent`, `UniswapV3CollectLedgerEvent`
- ✅ Barrel exports updated in `uniswapv3/index.ts` and `src/shared/types/index.ts`
- ✅ TypeScript compilation passes with no errors
- ✅ Implementation plan saved to `temp/POSITION_LEDGER_IMPLEMENTATION_PLAN.md`

**Architecture pattern**: Follows the same structure as Pool types (protocol-specific in subdirectories, lightweight mapping files in root)

---

### **Phase 2: Database Schema** (✅ COMPLETED)
**Status**: Schema implemented, Prisma client generated, ready for migration
**Completed**: 2025-01-XX

**What was built:**
- ✅ Added `PositionLedgerEvent` model to `prisma/schema.prisma`
  - Self-referential relation with `previousId`/`previousEvent`/`nextEvents` (NoAction on delete/update)
  - Foreign key to Position with CASCADE delete
  - Unique constraint on `inputHash`
  - All financial fields as String (for BigInt compatibility)
  - JSON fields for `config`, `state`, and `rewards`
  - 5 indexes for query optimization
- ✅ Added `ledgerEvents` relation to Position model
- ✅ Prisma client generated successfully
- ✅ Schema validated successfully (`prisma validate`)

**Migration status**: Schema ready, but migration not applied (requires DATABASE_URL)

**To apply when ready:**
```bash
# Set DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Create and apply migration
npx prisma migrate dev --name add_position_ledger_event
```

**Database table**: Will create `position_ledger_events` with all indexes and constraints

---

### **Phase 3: Etherscan Client** (✅ COMPLETED)
**Status**: Fully implemented, tested, and committed
**Completed**: 2025-10-18
**Commit**: `f61ed0e` - feat: implement Etherscan v2 API client for position ledger events (Phase 3)

**What was built:**
- ✅ Full EtherscanClient implementation in `src/clients/etherscan/etherscan-client.ts` (921 lines)
  - Uses Etherscan v2 unified API (single endpoint, single API key for all chains)
  - Rate limiting with RequestScheduler (220ms spacing, ~4.5 req/sec)
  - Manual retry logic with exponential backoff and jitter (max 6 attempts)
  - Special handling for Etherscan NOTOK rate limit responses
  - Distributed PostgreSQL-based caching for contract deployment blocks (1-year TTL)
  - Comprehensive error handling with custom error types

- ✅ Type definitions in `src/clients/etherscan/types.ts` (155 lines)
  - `EtherscanLog` - Raw log structure from API
  - `EtherscanLogsResponse`, `EtherscanBlockNumberResponse`, `EtherscanContractCreationResponse`
  - `RawPositionEvent` - Parsed position event with all event types
  - `FetchLogsOptions`, `FetchPositionEventsOptions` - Method options
  - `UniswapV3EventType` - Event type union

- ✅ Core methods implemented:
  - `fetchLogs(chainId, contractAddress, options)` - Generic log fetching with topic filters
  - `fetchPositionEvents(chainId, nftId, options)` - Fetch all events for a Uniswap V3 NFT position
  - `getContractCreationBlock(chainId, contractAddress)` - Get deployment block with permanent caching
  - `getBlockNumberForTimestamp(chainId, timestamp, closest)` - Convert timestamps to block numbers

- ✅ Event parsing for all three types:
  - INCREASE_LIQUIDITY - Parses liquidity (uint128), amount0 (uint256), amount1 (uint256)
  - DECREASE_LIQUIDITY - Parses liquidity (uint128), amount0 (uint256), amount1 (uint256)
  - COLLECT - Parses recipient (address), amount0 (uint256), amount1 (uint256)
  - 32-byte hex chunk decoding with proper BigInt handling

- ✅ Deduplication and sorting by blockchain order
  - Unique key: `${transactionHash}-${logIndex}`
  - Sort order: blockNumber → transactionIndex → logIndex

- ✅ Event signature constants and NFT Position Manager addresses:
  - Ethereum (1): 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 (block 12369651)
  - Arbitrum (42161): 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
  - Base (8453): 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1 (block 1371714)
  - Optimism (10): 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
  - Polygon (137): 0xC36442b4a4522E871399CD717aBDD847Ab11FE88

- ✅ Comprehensive unit tests (26/26 passing) in `etherscan-client.test.ts` (681 lines)
  - Singleton pattern and constructor tests
  - Chain support validation
  - All methods tested with mocked fetch responses
  - Error handling (API errors, rate limits, HTTP failures)
  - Event parsing for all three types (INCREASE, DECREASE, COLLECT)
  - Deduplication and sorting logic verification
  - Cache behavior verification

- ✅ Integration tests (12/12 passing) in `etherscan-client.integration.test.ts` (215 lines)
  - Real API calls with actual Etherscan API
  - Fetches real logs from Ethereum mainnet
  - Contract creation block verification
  - Block number to timestamp conversion
  - Position events parsing with real NFT positions
  - Cross-chain support (Ethereum, Arbitrum, Base)
  - Rate limiting verification (5 sequential requests)
  - Skip gracefully if ETHERSCAN_API_KEY not set

- ✅ Barrel exports in `src/clients/etherscan/index.ts` (25 lines)
  - Exports client class, error types, constants, and all type definitions

- ✅ Main clients export updated in `src/clients/index.ts` (+19 lines)
  - Added all Etherscan exports to main clients barrel

- ✅ Environment configuration updated in `.env.example` (+20 lines)
  - Added ETHERSCAN_API_KEY documentation with usage instructions
  - Explains single API key works for all chains

- ✅ TypeScript compilation passes with no errors
  - Strict mode compliance
  - Proper BigInt handling with non-null assertions
  - Type narrowing for API responses

**Architecture highlights:**
- Follows CoinGeckoClient patterns for consistency across the codebase
- Singleton pattern with dependency injection for testability
- Modern logging infrastructure integration (createServiceLogger, log helpers)
- Type-safe with full TypeScript definitions and discriminated unions
- Production-ready with comprehensive error handling (EtherscanApiError, EtherscanApiKeyMissingError)
- Uses existing utilities (RequestScheduler, CacheService)
- ESM-compatible with .js extensions in imports

**Test results:**
- Unit tests: 26/26 passing (~24ms)
- Integration tests: 12/12 passing (~8s with real API calls)
- Total implementation: 2,036 lines across 7 files

**Environment variables:**
- `ETHERSCAN_API_KEY` - Single API key for all chains (documented in .env.example)
  - Get at: https://etherscan.io/myapikey
  - Works for Ethereum, Arbitrum, Base, Optimism, Polygon

**Files changed:**
```
7 files changed, 2036 insertions(+)
- src/clients/etherscan/types.ts (new, 155 lines)
- src/clients/etherscan/etherscan-client.ts (new, 921 lines)
- src/clients/etherscan/etherscan-client.test.ts (new, 681 lines)
- src/clients/etherscan/etherscan-client.integration.test.ts (new, 215 lines)
- src/clients/etherscan/index.ts (new, 25 lines)
- src/clients/index.ts (modified, +19 lines)
- .env.example (modified, +20 lines)
```

---

### **Phase 4: Utility Functions** (✅ COMPLETED)
**Status**: Fully implemented and tested
**Completed**: 2025-10-18

**What was built:**
- ✅ Full implementation in `src/utils/uniswapv3/ledger-calculations.ts` (545 lines)
  - Pure TypeScript utility functions using BigInt throughout
  - All functions well-documented with JSDoc comments
  - Formulas explained with examples

- ✅ Five core calculation functions:
  - `calculatePoolPriceInQuoteToken()` - Convert sqrtPriceX96 to quote price (quote units per 1 base token)
  - `calculateTokenValueInQuote()` - Total value of token pair in quote currency
  - `calculateProportionalCostBasis()` - Proportional cost basis for DECREASE events
  - `separateFeesFromPrincipal()` - Separate collected tokens into fees vs principal for COLLECT events
  - `updateUncollectedPrincipal()` - Track uncollected principal pool across events

- ✅ Type definitions:
  - `FeeSeparationResult` - Result type for fee separation
  - `UncollectedPrincipalResult` - Result type for uncollected principal updates

- ✅ Comprehensive unit tests (713 lines) in `ledger-calculations.test.ts`
  - 51 tests passing (100% coverage of all functions)
  - Price calculations: 5 tests (token0/token1 as quote, different decimals)
  - Token value: 8 tests (both tokens, only quote, only base, large amounts)
  - Proportional cost basis: 11 tests (typical scenarios, edge cases, error handling)
  - Fee separation: 12 tests (all fees, all principal, mixed, sequential collects)
  - Uncollected principal: 15 tests (INCREASE/DECREASE/COLLECT events, chains)
  - All edge cases tested: zero values, negative values, division by zero
  - Integration scenarios: full event sequences

- ✅ Barrel exports updated in `src/utils/uniswapv3/index.ts`
  - All functions and types exported
  - Ready for consumption by service layer

- ✅ TypeScript compilation passes with no errors
  - Strict mode compliance
  - Proper BigInt handling throughout
  - Type-safe with explicit inputs/outputs

**Test results:**
- Unit tests: 51/51 passing (~6ms)
- Total project tests: 519/519 passing
- Zero regressions introduced

**Architecture highlights:**
- Pure functions with no side effects (easy to test and reason about)
- Reuses existing utilities from `src/shared/utils/uniswapv3/price.ts`
- BigInt throughout (no precision loss in financial calculations)
- Comprehensive error handling with descriptive error messages
- Well-documented with formulas and examples
- Ready for consumption by Phase 5 (Base Service) and Phase 6 (Uniswap V3 Service)

**Files created:**
```
2 files created, 1 modified, 1,258 lines total
- src/utils/uniswapv3/ledger-calculations.ts (new, 545 lines)
- src/utils/uniswapv3/ledger-calculations.test.ts (new, 713 lines)
- src/utils/uniswapv3/index.ts (modified, +9 lines)
```

---

### **Phase 5: Base Service** (✅ COMPLETED)
**Status**: Fully implemented and tested
**Completed**: 2025-10-18

**What was built:**
- ✅ Service input types in `src/services/types/position-ledger/position-ledger-event-input.ts` (176 lines)
  - `CreatePositionLedgerEventInput<P>` - Generic creation input (omits id, createdAt, updatedAt)
  - `UniswapV3LedgerEventDiscoverInput` - Detailed discovery input with blockchain event data
  - `PositionLedgerEventDiscoverInputMap` - Type-safe mapping for discovery inputs (following TokenDiscoverInputMap pattern)
  - `PositionLedgerEventDiscoverInput<P>` - Generic discovery input with full type safety
  - Protocol-specific type aliases: `CreateUniswapV3LedgerEventInput`, `UniswapV3EventDiscoverInput`

- ✅ Database serialization types in `src/services/types/uniswapv3/position-ledger-event-db.ts` (313 lines)
  - `UniswapV3LedgerEventConfigDB` - Config with all BigInt → string conversions
  - `UniswapV3LedgerEventStateDB` - Union type for all three event states (INCREASE/DECREASE/COLLECT)
  - Conversion functions: `toEventConfig()`, `toEventConfigDB()`, `toEventState()`, `toEventStateDB()`
  - Handles discriminated unions with type-safe conversions

- ✅ Abstract base service in `src/services/position-ledger/position-ledger-service.ts` (540 lines)
  - Generic `PositionLedgerService<P>` class with protocol parameter
  - **Abstract methods** (strongly typed, no `unknown` types):
    - `parseConfig()`, `serializeConfig()` - Config serialization with mapped types
    - `parseState()`, `serializeState()` - State serialization with `PositionLedgerEventStateMap[P]['state']`
    - `generateInputHash()` - Protocol-specific hash generation
    - `discoverAllEvents()` - Fetch complete blockchain history
    - `discoverEvent(positionId, input: PositionLedgerEventDiscoverInput<P>)` - Add single event (typed!)
  - **CRUD operations**:
    - `findAllItems()` - Get all events for position, sorted descending by timestamp
    - `addItem()` - Add event with validation, returns complete history
    - `deleteAllItems()` - Delete all events for position (idempotent)
  - **Protected helpers**:
    - `mapToLedgerEvent()` - DB → TypeScript conversion with BigInt parsing
    - `validateEventSequence()` - Ensure valid event chain (previousId, protocol, position checks)
  - Comprehensive logging with `createServiceLogger` and log helpers
  - Dependency injection for Prisma client

- ✅ Test fixtures in `src/services/position-ledger/test-fixtures.ts` (567 lines)
  - Realistic event fixtures for all three types (INCREASE, DECREASE, COLLECT)
  - Complete financial state progression (cost basis: 2000 → 1000, PnL: 0 → +100)
  - Discovery input fixtures for each event type
  - Helper function: `createEventFixture()` for custom test data
  - WETH/USDC pool scenario with proper decimals (18/6)

- ✅ Comprehensive unit tests in `src/services/position-ledger/position-ledger-service.test.ts` (568 lines)
  - **38 tests, all passing** ✅
  - Mock concrete implementation (MockUniswapV3PositionLedgerService) for testing abstract class
  - Test coverage:
    - Constructor and dependency injection (3 tests)
    - Config serialization (3 tests - serialize, parse, round-trip)
    - State serialization (7 tests - all three event types, round-trip)
    - Input hash generation (2 tests)
    - Event sequence validation (5 tests - first event, valid chain, error cases)
    - CRUD operations (12 tests - findAllItems, addItem, deleteAllItems)
    - Edge cases (4 tests - zero liquidity, empty rewards, negative PnL, large BigInt)
    - Error handling (3 tests - database errors propagation)

- ✅ Barrel exports updated:
  - `src/services/position-ledger/index.ts` - Service exports
  - `src/services/types/position-ledger/index.ts` - Input type exports
  - `src/services/types/uniswapv3/index.ts` - Added DB serialization exports
  - `src/services/types/index.ts` - Added all position ledger types to main barrel

**Test results:**
- Unit tests: 38/38 passing (~28ms)
- Total project tests: 557/557 passing (all unit tests)
- TypeScript compilation: ✅ Successful (strict mode)
- Zero regressions introduced

**Architecture highlights:**
- Follows `TokenService` → `Erc20TokenService` pattern exactly
- Type-safe discovery inputs using mapped types (like `TokenDiscoverInputMap`)
- Abstract methods use `PositionLedgerEventStateMap[P]['state']` (not ConfigMap)
- BigInt serialization handled correctly throughout
- Dependency injection pattern for testability
- Comprehensive logging infrastructure
- Ready for Phase 6 (UniswapV3PositionLedgerService implementation)

**Files created:**
```
7 files created/modified, ~1,800 lines total
- src/services/types/position-ledger/position-ledger-event-input.ts (new, 176 lines)
- src/services/types/position-ledger/index.ts (new, 13 lines)
- src/services/types/uniswapv3/position-ledger-event-db.ts (new, 313 lines)
- src/services/types/uniswapv3/index.ts (modified, +14 lines)
- src/services/position-ledger/position-ledger-service.ts (new, 540 lines)
- src/services/position-ledger/test-fixtures.ts (new, 567 lines)
- src/services/position-ledger/position-ledger-service.test.ts (new, 568 lines)
- src/services/position-ledger/index.ts (new, 6 lines)
- src/services/types/index.ts (modified, +17 lines)
```

---

### **Phase 6: Uniswap V3 Service** (⏳ TODO)
   - Implement UniswapV3PositionLedgerService
   - discoverAllEvents() with Etherscan integration
   - discoverEvent() for single event addition
   - generateInputHash() implementation
   - Sequential state building with PnL calculations

### **Phase 7: Testing & Validation** (⏳ TODO)
   - Comprehensive unit tests
   - Integration tests with real blockchain data
   - Validate against legacy calculations
   - Test fixtures for common scenarios

---

## Progress Summary

### ✅ Completed Phases: 5 / 7
- **Phase 1**: Type Definitions (Fully complete with reorganization)
- **Phase 2**: Database Schema (Complete, ready for migration)
- **Phase 3**: Etherscan Client (Fully implemented with comprehensive tests)
- **Phase 4**: Utility Functions (All calculation utilities implemented and tested)
- **Phase 5**: Base Service (Abstract service layer with 38 passing tests)

### ⏳ Remaining Work:
- **Phase 6**: Uniswap V3 Service (Concrete implementation)
- **Phase 7**: Testing & Validation (Comprehensive tests)

### Current Status: Ready for Phase 6
All foundational infrastructure is complete:
- ✅ Type system for position ledger events
- ✅ Database schema for event storage
- ✅ Etherscan client for blockchain event discovery
- ✅ Financial calculation utilities (PnL, cost basis, fee separation)
- ✅ Abstract base service with CRUD operations and validation

Next step is implementing the abstract PositionLedgerService base class that will use these utilities to manage position ledger state.

## Key Design Decisions

1. **Linked List Structure**: Events use previousId to form a chain (can traverse history)
2. **Immutable History**: discoverAllEvents() deletes and rebuilds (prevents inconsistency)
3. **Sequential Processing**: Each event depends on previous state (no parallel processing)
4. **Idempotency**: inputHash ensures duplicate events are rejected
5. **BigInt Everywhere**: All financial values use BigInt (no precision loss)
6. **Fee Separation**: Track uncollected principal separately for accurate fee accounting
7. **Descending Order**: Return events newest-first for UI display
8. **Rate Limit Safe**: Use RequestScheduler + RetryHandler for all Etherscan calls

## Testing Strategy

- **Unit Tests**: Mock all external dependencies (Prisma, Etherscan, blockchain)
- **Integration Tests**: Real data, but rate-limit conscious (use test fixtures + caching)
- **Financial Validation**: Cross-check calculations against legacy implementation
- **Edge Cases**: Zero liquidity, multiple events in same block, fee-only collects

## Legacy Implementation Reference

Key files from temp/midcurve-finance-legacy/:
- `src/services/positions/positionLedgerService.ts` - Main ledger logic
- `src/services/etherscan/etherscanClient.ts` - Etherscan integration
- `src/services/etherscan/etherscanEventService.ts` - Event fetching and parsing

## Financial Calculation Algorithms

### Cost Basis Tracking
```
INCREASE_LIQUIDITY:
  costBasisAfter = costBasisAfter + tokenValueInQuote

DECREASE_LIQUIDITY:
  proportionalCostBasis = (currentCostBasis * deltaL) / currentLiquidity
  costBasisAfter = costBasisAfter - proportionalCostBasis

COLLECT:
  costBasisAfter unchanged (fees don't affect cost basis)
```

### PnL Realization
```
INCREASE_LIQUIDITY:
  realizedPnLAfter unchanged (no realization)

DECREASE_LIQUIDITY:
  realizedPnL = tokenValueInQuote - proportionalCostBasis
  realizedPnLAfter = realizedPnLAfter + realizedPnL

COLLECT:
  realizedPnLAfter unchanged (fees tracked separately)
```

### Fee Separation
```
DECREASE_LIQUIDITY:
  uncollectedPrincipal0After += amount0
  uncollectedPrincipal1After += amount1

COLLECT:
  principalCollected0 = min(collected0, uncollectedPrincipal0)
  principalCollected1 = min(collected1, uncollectedPrincipal1)
  feeToken0 = collected0 - principalCollected0
  feeToken1 = collected1 - principalCollected1
  uncollectedPrincipal0After -= principalCollected0
  uncollectedPrincipal1After -= principalCollected1
```

## Event Ordering Rules

**Critical**: Events MUST be processed in blockchain order:
1. Sort by `blockNumber` ASC
2. Then by `transactionIndex` ASC
3. Then by `logIndex` ASC

**Input Hash**: MD5(blockNumber + txIndex + logIndex)
- Ensures idempotent event processing
- Prevents duplicates across restarts

## Token Value Calculation

```typescript
if (token0IsQuote) {
  // token0 = quote, token1 = base
  token1ValueInQuote = (amount1 * poolPrice) / 10^token1Decimals
  totalValue = amount0 + token1ValueInQuote
} else {
  // token1 = quote, token0 = base
  token0ValueInQuote = (amount0 * poolPrice) / 10^token0Decimals
  totalValue = amount1 + token0ValueInQuote
}
```

## Etherscan Event Signatures

```typescript
const EVENT_SIGNATURES = {
  INCREASE_LIQUIDITY: '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f',
  DECREASE_LIQUIDITY: '0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4',
  COLLECT: '0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01',
};
```

## Rate Limiting Configuration

- **Etherscan API**: 5 calls/second (200ms spacing)
- Use `RequestScheduler` with 220ms spacing (safety margin)
- Use `RetryHandler` with exponential backoff on 429 errors
- Global scheduler ensures process-wide serialization
