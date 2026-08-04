import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n/index';
import { QuotaTimeline } from '../src/features/quota/components/QuotaTimeline';
import type { QuotaFileEntry } from '../src/features/quota/logic';

const entries: QuotaFileEntry[] = [
  {
    file: { name: 'weekly-only.json', type: 'claude' },
    type: 'claude',
  },
];

const now = new Date(2026, 6, 29, 12).getTime();
const resetCreditExpiry = '2026-08-03T12:00:00Z';
const weeklyWindow = {
  status: 'success' as const,
  windows: [
    {
      label: '7-day',
      usedPercent: 25,
      resetAtMs: new Date(2026, 7, 1, 12).getTime(),
      periodHours: 168,
    },
  ],
};

describe('QuotaTimeline rendering', () => {
  test('shows the selected period date instead of always labelling it Today', () => {
    const markup = renderToStaticMarkup(
      createElement(QuotaTimeline, {
        entries,
        resolvedTheme: 'light',
        now,
        initialOffset: 1,
        quotaFor: () => weeklyWindow,
      })
    );

    expect(markup).toMatch(/<button[^>]+title="[^"]+"[^>]*>08\/02<\/button>/);
  });

  test('renders an unexpired Codex reset credit as an expiry tick', () => {
    const markup = renderToStaticMarkup(
      createElement(QuotaTimeline, {
        entries: [
          {
            file: { name: 'codex-credit.json', type: 'codex' },
            type: 'codex',
          },
        ],
        resolvedTheme: 'light',
        now,
        quotaFor: () => ({
          ...weeklyWindow,
          rateLimitResetCredits: [
            {
              id: 'credit-1',
              status: 'available',
              grantedAt: '2026-07-20T12:00:00Z',
              expiresAt: resetCreditExpiry,
            },
          ],
        }),
      })
    );

    expect(markup).toContain('role="img"');
    const expiry = new Date(resetCreditExpiry);
    const expiryLabel = `08/03 ${String(expiry.getHours()).padStart(2, '0')}:${String(
      expiry.getMinutes()
    ).padStart(2, '0')}`;
    expect(markup).toContain(expiryLabel);
  });
});
