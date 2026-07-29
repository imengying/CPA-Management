import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { buildClaudeQuotaWindows } from '@/components/quota/quotaConfigs';
import type { ClaudeUsagePayload } from '@/types';
import { formatQuotaResetTime } from '@/utils/quota';

const t = ((key: string) => key) as TFunction;
const modernReset = '2026-07-27T10:00:00.000000+00:00';
const alternateReset = '2026-07-28T10:00:00.000000+00:00';

describe('Claude Fable quota', () => {
  test('builds the modern scoped limit', () => {
    const windows = buildClaudeQuotaWindows(
      {
        limits: [
          {
            kind: 'weekly_scoped',
            percent: 64,
            resets_at: modernReset,
            is_active: true,
            scope: { model: { display_name: 'Fable' } },
          },
        ],
      },
      t
    );

    expect(windows).toEqual([
      {
        id: 'seven-day-fable',
        label: 'claude_quota.seven_day_fable',
        labelKey: 'claude_quota.seven_day_fable',
        usedPercent: 64,
        resetLabel: formatQuotaResetTime(modernReset),
      },
    ]);
  });

  test('prefers an active modern limit without rendering a duplicate', () => {
    const payload: ClaudeUsagePayload = {
      limits: [
        {
          kind: 'weekly_scoped',
          percent: 12,
          resets_at: alternateReset,
          is_active: false,
          scope: { model: { display_name: 'Fable 5' } },
        },
        {
          kind: 'weekly_scoped',
          percent: 64,
          resets_at: modernReset,
          is_active: true,
          scope: { model: { display_name: 'Fable' } },
        },
      ],
    };

    const windows = buildClaudeQuotaWindows(payload, t);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ id: 'seven-day-fable', usedPercent: 64 });
  });

  test('ignores invalid modern limits and preserves standard windows', () => {
    const payload = {
      five_hour: { utilization: 10, resets_at: null },
      seven_day: { utilization: 20, resets_at: alternateReset },
      limits: [
        null,
        { kind: 'weekly_scoped', percent: 35, scope: { model: { display_name: 'Sonnet' } } },
        { kind: 'weekly_scoped', percent: null, scope: { model: { display_name: 'Fable' } } },
      ],
    } as unknown as ClaudeUsagePayload;

    const windows = buildClaudeQuotaWindows(payload, t);
    expect(windows.map(({ id, usedPercent }) => ({ id, usedPercent }))).toEqual([
      { id: 'five-hour', usedPercent: 10 },
      { id: 'seven-day', usedPercent: 20 },
    ]);
  });
});
