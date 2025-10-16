/**
 * Setup file for integration tests
 * Runs before each test file
 *
 * Responsibilities:
 * - Clean database before each test file
 * - Provide clean state for each test suite
 */

import { afterEach } from 'vitest';
import { clearDatabase } from './helpers.js';

// Clean database after each test to ensure isolation
afterEach(async () => {
  await clearDatabase();
});
