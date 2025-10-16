/**
 * Global setup for integration tests
 * Runs once before all test files
 *
 * Responsibilities:
 * - Ensure test database is available
 * - Run Prisma migrations
 * - Prepare database schema
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

export default async function globalSetup() {
  console.log('\n🔧 Setting up integration test environment...\n');

  // DATABASE_URL should be loaded from .env.test via --env-file flag
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Make sure .env.test exists with DATABASE_URL defined.\n' +
      'Run: cp .env.example .env.test'
    );
  }

  console.log(`📊 Using database: ${databaseUrl.split('@')[1]?.split('?')[0] || 'unknown'}`);

  // Set DATABASE_URL for Prisma CLI commands
  process.env.DATABASE_URL = databaseUrl;

  try {
    // Test database connection
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

    // Push schema to test database (creates/updates tables without migrations)
    console.log('📦 Pushing database schema...');
    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log('✅ Database schema ready\n');

  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }
}
