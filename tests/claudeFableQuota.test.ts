import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { buildClaudeQuotaWindows } from '@/features/quota/providers/claude/data';
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
        resetAtMs: Date.parse(modernReset),
        periodHours: 24 * 7,
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

  test('shows a dollar-denominated legacy field as cloud session credits, not Fable', () => {
    const reset = '2026-11-05T07:59:00+00:00';
    const windows = buildClaudeQuotaWindows(
      {
        iguana_necktie: {
          utilization: 5.043595,
          resets_at: reset,
          limit_dollars: 100,
          used_dollars: 5.043595,
          remaining_dollars: 94.956405,
        },
        limits: [{ kind: 'weekly_all', percent: 9, resets_at: modernReset, is_active: false }],
      },
      t
    );

    expect(windows).toEqual([
      {
        id: 'cloud-session-credits',
        label: 'claude_quota.cloud_session_credits',
        labelKey: 'claude_quota.cloud_session_credits',
        usedPercent: 5.043595,
        resetLabel: formatQuotaResetTime(reset),
        resetAtMs: Date.parse(reset),
        periodHours: null,
      },
    ]);
  });

  test('shows both cloud session credits and the scoped Fable limit', () => {
    const windows = buildClaudeQuotaWindows(
      {
        iguana_necktie: {
          utilization: 5,
          resets_at: '2026-11-05T07:59:00+00:00',
          limit_dollars: 100,
          used_dollars: 5,
        },
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

    expect(windows.map((window) => [window.id, window.usedPercent])).toEqual([
      ['cloud-session-credits', 5],
      ['seven-day-fable', 64],
    ]);
  });

  test('treats a legacy field with only remaining_dollars as cloud session credits', () => {
    const windows = buildClaudeQuotaWindows(
      {
        iguana_necktie: {
          utilization: 5,
          resets_at: '2026-11-05T07:59:00+00:00',
          remaining_dollars: 95,
        },
      },
      t
    );

    expect(windows.map((window) => [window.id, window.usedPercent])).toEqual([
      ['cloud-session-credits', 5],
    ]);
  });

  test('drops the legacy field when it carries no dollar amounts', () => {
    // This fork removed the old Fable fallback; without money fields the
    // payload would otherwise resurface as a second Fable row.
    const windows = buildClaudeQuotaWindows(
      {
        iguana_necktie: { utilization: 41, resets_at: modernReset },
      },
      t
    );

    expect(windows).toEqual([]);
  });
});
