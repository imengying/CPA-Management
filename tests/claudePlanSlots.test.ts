import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { ClaudeQuotaBody } from '@/features/quota/providers/claude/ClaudeQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import type { ClaudeQuotaState } from '@/types';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'claude-plan-slots-test'
);

const render = (quota: ClaudeQuotaState, extra: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(ClaudeQuotaBody, { quota, classes, ...extra })
    )
  );

const quota = (overrides: Partial<ClaudeQuotaState> = {}): ClaudeQuotaState => ({
  status: 'success',
  windows: [
    {
      id: 'five-hour',
      label: '5 小时',
      labelKey: 'claude_quota.five_hour',
      usedPercent: 20,
    },
  ],
  ...overrides,
});

describe('ClaudeQuotaBody plan row slots', () => {
  test('host chips join the plan row and host content follows it', () => {
    const markup = render(quota(), {
      planItems: createElement('span', { 'data-slot': 'chip' }, 'CHIP'),
      afterPlan: createElement('div', { 'data-slot': 'after' }, 'AFTER'),
    });

    expect(markup).toContain('CHIP');
    expect(markup).toContain('AFTER');
    // chip 在套餐行内，after 在套餐行之后、用量行之前
    expect(markup.indexOf('CHIP')).toBeLessThan(markup.indexOf('AFTER'));
    expect(markup.indexOf('AFTER')).toBeLessThan(markup.indexOf('quotaRow'));
  });

  test('renders host chips without a plan type, and nothing when both are absent', () => {
    const withChip = render(quota({ planType: null }), {
      planItems: createElement('span', { 'data-slot': 'chip' }, 'CHIP'),
    });
    expect(withChip).toContain('CHIP');

    const bare = render(quota({ planType: null }), {});
    expect(bare).not.toContain('codexPlan');
    expect(bare).toContain('quotaRow');
  });
});
