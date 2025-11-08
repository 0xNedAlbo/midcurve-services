import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { CoinGeckoClient } from '../clients/coingecko/index.js';
async function warmUpCoinGeckoCache() {
    console.log('🔥 Warming up CoinGecko cache...');
    try {
        const client = CoinGeckoClient.getInstance();
        const TEST_COIN_IDS = ['usd-coin', 'weth', 'dai'];
        console.log('  📋 Step 1: Fetching token list with platform data...');
        const tokens = await client.getAllTokens();
        console.log(`  ✅ Cached ${tokens.length} tokens with platform addresses`);
        console.log(`  💰 Step 2: Fetching market data for ${TEST_COIN_IDS.length} coins: ${TEST_COIN_IDS.join(', ')}...`);
        const marketData = await client.getCoinsMarketData(TEST_COIN_IDS);
        console.log(`  ✅ Cached market data for ${marketData.length} coins`);
        console.log('  🔧 Step 3: Populating individual coin detail caches...');
        for (const market of marketData) {
            const token = tokens.find((t) => t.id === market.id);
            if (!token) {
                console.warn(`  ⚠️  Token ${market.id} not found in token list`);
                continue;
            }
            const detailedCoin = {
                id: market.id,
                symbol: market.symbol,
                name: market.name,
                image: {
                    thumb: market.image,
                    small: market.image,
                    large: market.image,
                },
                market_data: {
                    market_cap: {
                        usd: market.market_cap,
                    },
                },
                platforms: token.platforms,
            };
            const cacheKey = `coingecko:coin:${market.id}`;
            const cacheService = client.cacheService;
            const cacheTimeout = client.cacheTimeout;
            await cacheService.set(cacheKey, detailedCoin, cacheTimeout);
        }
        console.log(`  ✅ Populated ${marketData.length} individual coin detail caches`);
        console.log('🎉 Cache warming complete! Total: 2 API calls (getAllTokens + getCoinsMarketData)\n');
    }
    catch (error) {
        console.warn('⚠️  Cache warming failed (tests will make real API calls):', error);
    }
}
export default async function globalSetup() {
    console.log('\n🔧 Setting up integration test environment...\n');
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not set. Make sure .env.test exists with DATABASE_URL defined.\n' +
            'Run: cp .env.example .env.test');
    }
    console.log(`📊 Using database: ${databaseUrl.split('@')[1]?.split('?')[0] || 'unknown'}`);
    process.env.DATABASE_URL = databaseUrl;
    try {
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: databaseUrl,
                },
            },
        });
        await prisma.$connect();
        console.log('✅ Database connection successful');
        await prisma.$disconnect();
        console.log('📦 Pushing database schema...');
        execSync('npx prisma db push --skip-generate --accept-data-loss', {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: databaseUrl },
        });
        console.log('✅ Database schema ready\n');
        await warmUpCoinGeckoCache();
    }
    catch (error) {
        console.error('❌ Failed to setup test database:', error);
        throw error;
    }
}
//# sourceMappingURL=global-setup.js.map