import { describe, expect, test } from 'bun:test';
import {
  XAI_WEEKLY_ROW_ID,
  collectQuotaRowInstants,
  nextRecoveryMs,
  pickSoonestRowId,
  pickUrgentRowId,
} from '../src/features/quota/resetSchedule';
import { HOUR_MS } from '../src/utils/time/durations';

describe('quota reset schedule', () => {
  const now = Date.UTC(2026, 7, 4, 0, 0);

  test('combines Codex windows with available manual reset credits', () => {
    const instants = collectQuotaRowInstants('codex', {
      status: 'success',
      windows: [{ id: 'five-hour', resetAtMs: now + 2 * HOUR_MS }],
      rateLimitResetCredits: [
        {
          id: 'credit-a',
          status: 'available',
          expiresAt: new Date(now + HOUR_MS).toISOString(),
        },
        {
          id: 'credit-used',
          status: 'used',
          expiresAt: new Date(now + 30 * 60_000).toISOString(),
        },
      ],
    });

    expect(instants.map((instant) => instant.rowId)).toEqual(['five-hour', 'credit-a']);
    expect(nextRecoveryMs('codex', { status: 'success', windows: [] }, now)).toBeNull();
  });

  test('treats only the xAI weekly period as capacity recovery', () => {
    expect(
      collectQuotaRowInstants('xai', {
        status: 'success',
        billing: { periodType: 'weekly', resetAtMs: now + HOUR_MS },
      })
    ).toEqual([{ rowId: XAI_WEEKLY_ROW_ID, atMs: now + HOUR_MS, kind: 'window' }]);
    expect(
      collectQuotaRowInstants('xai', {
        status: 'success',
        billing: { periodType: 'monthly', resetAtMs: now + HOUR_MS },
      })
    ).toEqual([]);
  });

  test('highlights only the nearest recovery strictly inside the final hour', () => {
    const instants = [
      { rowId: 'later', atMs: now + HOUR_MS, kind: 'window' as const },
      { rowId: 'urgent', atMs: now + HOUR_MS - 1, kind: 'window' as const },
      { rowId: 'expired', atMs: now, kind: 'window' as const },
    ];

    expect(pickSoonestRowId(instants, now)).toBe('urgent');
    expect(pickUrgentRowId(instants, now)).toBe('urgent');
    expect(pickUrgentRowId([{ ...instants[0] }], now)).toBeNull();
  });
});
