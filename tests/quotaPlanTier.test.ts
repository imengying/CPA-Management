import { describe, expect, test } from 'bun:test';
import { resolvePlanTier } from '@/utils/quota';

describe('resolvePlanTier', () => {
  test("maps 'pro' to the elite Pro 20x treatment", () => {
    expect(resolvePlanTier('pro')).toBe('elite');
  });

  test('normalizes case and whitespace before matching', () => {
    expect(resolvePlanTier('PRO')).toBe('elite');
    expect(resolvePlanTier('  Pro  ')).toBe('elite');
    expect(resolvePlanTier('Pro-Lite')).toBe('premium');
  });

  test('maps every pro-lite spelling to premium', () => {
    expect(resolvePlanTier('prolite')).toBe('premium');
    expect(resolvePlanTier('pro-lite')).toBe('premium');
    expect(resolvePlanTier('pro_lite')).toBe('premium');
  });

  test('maps ordinary and unknown plans to plain', () => {
    expect(resolvePlanTier('plus')).toBe('plain');
    expect(resolvePlanTier('team')).toBe('plain');
    expect(resolvePlanTier('free')).toBe('plain');
    expect(resolvePlanTier('enterprise')).toBe('plain');
  });

  test('maps missing values to plain', () => {
    expect(resolvePlanTier(null)).toBe('plain');
    expect(resolvePlanTier(undefined)).toBe('plain');
    expect(resolvePlanTier('')).toBe('plain');
    expect(resolvePlanTier('   ')).toBe('plain');
  });
});
