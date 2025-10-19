/**
 * APR Calculation Utilities - Unit Tests
 *
 * Tests for pure APR calculation functions.
 * All tests use BigInt for precision and smallest units (micro-USDC, wei, etc.).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAprBps,
  calculateDurationSeconds,
  secondsToDays,
  calculateAverageCostBasis,
  aprBpsToPercent,
  aprPercentToBps,
  SECONDS_PER_YEAR,
  BASIS_POINTS_MULTIPLIER,
} from './apr-calculations.js';

describe('APR Calculations', () => {
  describe('calculateAprBps', () => {
    it('should calculate APR correctly for 7-day period', () => {
      // 50 USDC fees on 10,000 USDC over 7 days
      const collectedFeeValue = 50_000000n; // 50 USDC (6 decimals)
      const costBasis = 10000_000000n; // 10,000 USDC
      const durationSeconds = 604_800; // 7 days

      const aprBps = calculateAprBps(collectedFeeValue, costBasis, durationSeconds);

      // Expected: (50 / 10,000) × (31,557,600 / 604,800) × 10,000
      //         = 0.005 × 52.17857 × 10,000
      //         = 2608.9 (BigInt truncates to 2608)
      expect(aprBps).toBe(2608);
    });

    it('should calculate APR correctly for 30-day period', () => {
      // 100 USDC fees on 5,000 USDC over 30 days
      const collectedFeeValue = 100_000000n; // 100 USDC
      const costBasis = 5000_000000n; // 5,000 USDC
      const durationSeconds = 2_592_000; // 30 days

      const aprBps = calculateAprBps(collectedFeeValue, costBasis, durationSeconds);

      // Expected: (100 / 5,000) × (31,557,600 / 2,592,000) × 10,000
      //         = 0.02 × 12.178 × 10,000
      //         = 2435.6 ≈ 2435 bps (24.35%)
      expect(aprBps).toBe(2435);
    });

    it('should calculate APR correctly for 1-year period', () => {
      // 1,000 USDC fees on 10,000 USDC over 1 year
      const collectedFeeValue = 1000_000000n; // 1,000 USDC
      const costBasis = 10000_000000n; // 10,000 USDC
      const durationSeconds = SECONDS_PER_YEAR;

      const aprBps = calculateAprBps(collectedFeeValue, costBasis, durationSeconds);

      // Expected: (1,000 / 10,000) × (31,557,600 / 31,557,600) × 10,000
      //         = 0.1 × 1 × 10,000
      //         = 1000 bps (10%)
      expect(aprBps).toBe(1000);
    });

    it('should return 0 APR when no fees collected', () => {
      const collectedFeeValue = 0n;
      const costBasis = 10000_000000n;
      const durationSeconds = 604_800;

      const aprBps = calculateAprBps(collectedFeeValue, costBasis, durationSeconds);

      expect(aprBps).toBe(0);
    });

    it('should handle very small fees correctly', () => {
      // 1 USDC fees on 10,000 USDC over 7 days
      const collectedFeeValue = 1_000000n; // 1 USDC (6 decimals)
      const costBasis = 10000_000000n; // 10,000 USDC
      const durationSeconds = 604_800; // 7 days

      const aprBps = calculateAprBps(collectedFeeValue, costBasis, durationSeconds);

      // Expected: (1 / 10,000) × (31,557,600 / 604,800) × 10,000
      //         = 0.0001 × 52.17857 × 10,000
      //         = 52 bps (0.52%)
      expect(aprBps).toBeGreaterThan(50);
      expect(aprBps).toBeLessThan(55);
    });

    it('should handle large fees correctly', () => {
      // 5,000 USDC fees on 10,000 USDC over 7 days (50% return in a week!)
      const collectedFeeValue = 5000_000000n; // 5,000 USDC
      const costBasis = 10000_000000n; // 10,000 USDC
      const durationSeconds = 604_800; // 7 days

      const aprBps = calculateAprBps(collectedFeeValue, costBasis, durationSeconds);

      // Expected: (5,000 / 10,000) × (31,557,600 / 604,800) × 10,000
      //         = 0.5 × 52.17857 × 10,000
      //         = 260,893 bps (2608.93%)
      expect(aprBps).toBeGreaterThan(260_000);
      expect(aprBps).toBeLessThan(261_000);
    });

    it('should throw error for zero cost basis', () => {
      const collectedFeeValue = 50_000000n;
      const costBasis = 0n;
      const durationSeconds = 604_800;

      expect(() => calculateAprBps(collectedFeeValue, costBasis, durationSeconds)).toThrow(
        'Cost basis cannot be zero'
      );
    });

    it('should throw error for non-positive duration', () => {
      const collectedFeeValue = 50_000000n;
      const costBasis = 10000_000000n;

      expect(() => calculateAprBps(collectedFeeValue, costBasis, 0)).toThrow(
        'Duration must be positive'
      );

      expect(() => calculateAprBps(collectedFeeValue, costBasis, -100)).toThrow(
        'Duration must be positive'
      );
    });

    it('should throw error for negative fees', () => {
      const collectedFeeValue = -50_000000n;
      const costBasis = 10000_000000n;
      const durationSeconds = 604_800;

      expect(() => calculateAprBps(collectedFeeValue, costBasis, durationSeconds)).toThrow(
        'Collected fee value cannot be negative'
      );
    });
  });

  describe('calculateDurationSeconds', () => {
    it('should calculate duration correctly for 7 days', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-08T00:00:00Z');

      const duration = calculateDurationSeconds(start, end);

      expect(duration).toBe(604_800); // 7 × 24 × 60 × 60
    });

    it('should calculate duration correctly for 30 days', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T00:00:00Z');

      const duration = calculateDurationSeconds(start, end);

      expect(duration).toBe(2_592_000); // 30 × 24 × 60 × 60
    });

    it('should calculate duration correctly for 1 hour', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T01:00:00Z');

      const duration = calculateDurationSeconds(start, end);

      expect(duration).toBe(3_600); // 60 × 60
    });

    it('should return 0 for same timestamp', () => {
      const timestamp = new Date('2024-01-01T00:00:00Z');

      const duration = calculateDurationSeconds(timestamp, timestamp);

      expect(duration).toBe(0);
    });

    it('should throw error if end is before start', () => {
      const start = new Date('2024-01-08T00:00:00Z');
      const end = new Date('2024-01-01T00:00:00Z');

      expect(() => calculateDurationSeconds(start, end)).toThrow(
        'End timestamp must be after start timestamp'
      );
    });
  });

  describe('secondsToDays', () => {
    it('should convert 7 days correctly', () => {
      const days = secondsToDays(604_800);
      expect(days).toBe(7);
    });

    it('should convert 30 days correctly', () => {
      const days = secondsToDays(2_592_000);
      expect(days).toBe(30);
    });

    it('should handle fractional days', () => {
      const days = secondsToDays(691_200); // 8 days
      expect(days).toBe(8);
    });

    it('should handle 1 hour', () => {
      const days = secondsToDays(3_600);
      expect(days).toBeCloseTo(0.041667, 5); // 1/24
    });
  });

  describe('calculateAverageCostBasis', () => {
    it('should calculate average of multiple values', () => {
      const values = [
        10000_000000n, // 10,000 USDC
        12000_000000n, // 12,000 USDC
        11000_000000n, // 11,000 USDC
      ];

      const average = calculateAverageCostBasis(values);

      expect(average).toBe(11000_000000n); // 11,000 USDC
    });

    it('should return single value for array of one', () => {
      const values = [10000_000000n];

      const average = calculateAverageCostBasis(values);

      expect(average).toBe(10000_000000n);
    });

    it('should handle large numbers', () => {
      const values = [
        1000000_000000n, // 1,000,000 USDC
        2000000_000000n, // 2,000,000 USDC
        3000000_000000n, // 3,000,000 USDC
      ];

      const average = calculateAverageCostBasis(values);

      expect(average).toBe(2000000_000000n); // 2,000,000 USDC
    });

    it('should floor fractional results', () => {
      const values = [
        10000_000000n, // 10,000 USDC
        10000_000001n, // 10,000.000001 USDC
        10000_000002n, // 10,000.000002 USDC
      ];

      const average = calculateAverageCostBasis(values);

      // (30,000.000003 / 3) = 10,000.000001 (BigInt floors)
      expect(average).toBe(10000_000001n);
    });

    it('should throw error for empty array', () => {
      expect(() => calculateAverageCostBasis([])).toThrow(
        'Cannot calculate average of empty array'
      );
    });
  });

  describe('aprBpsToPercent', () => {
    it('should convert 2500 bps to 25%', () => {
      expect(aprBpsToPercent(2500)).toBe(25.0);
    });

    it('should convert 1000 bps to 10%', () => {
      expect(aprBpsToPercent(1000)).toBe(10.0);
    });

    it('should convert 0 bps to 0%', () => {
      expect(aprBpsToPercent(0)).toBe(0);
    });

    it('should handle fractional percentages', () => {
      expect(aprBpsToPercent(2609)).toBe(26.09);
    });
  });

  describe('aprPercentToBps', () => {
    it('should convert 25% to 2500 bps', () => {
      expect(aprPercentToBps(25.0)).toBe(2500);
    });

    it('should convert 10% to 1000 bps', () => {
      expect(aprPercentToBps(10.0)).toBe(1000);
    });

    it('should convert 0% to 0 bps', () => {
      expect(aprPercentToBps(0)).toBe(0);
    });

    it('should round fractional basis points', () => {
      expect(aprPercentToBps(26.09)).toBe(2609);
      expect(aprPercentToBps(26.094)).toBe(2609);
      expect(aprPercentToBps(26.095)).toBe(2610);
    });
  });

  describe('constants', () => {
    it('should have correct SECONDS_PER_YEAR', () => {
      // 365.25 days × 24 hours × 60 minutes × 60 seconds
      expect(SECONDS_PER_YEAR).toBe(31_557_600);
    });

    it('should have correct BASIS_POINTS_MULTIPLIER', () => {
      expect(BASIS_POINTS_MULTIPLIER).toBe(10_000);
    });
  });
});
