import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/**
 * 卡片上的 weight 提示是原生 title 属性，只能承载纯文本；
 * 详情面板里取值语义走纯文本 weight_hint，含链接的「需开启加权轮询」走
 * weight_strategy_note 交给 <Trans> 渲染链接——提示里键盘够不到链接。
 * 两者必须分开维护，避免其中一处把 HTML 标签当正文显示。
 */
const cardSource = readFileSync(
  new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url),
  'utf8'
);

describe('auth file weight tooltip contract', () => {
  test('the card uses the plain-text tooltip key', () => {
    expect(cardSource).toContain("title={t('auth_files.weight_tooltip')}");
    expect(cardSource).not.toContain("title={t('auth_files.weight_hint')}");
  });

  test('the details sheet keeps the link-bearing note for <Trans>', () => {
    const detailsSource = readFileSync(
      new URL('../src/features/authFiles/components/AuthFileDetailsSheet.tsx', import.meta.url),
      'utf8'
    );
    expect(detailsSource).toContain('i18nKey="auth_files.weight_strategy_note"');
    expect(detailsSource).toContain("hint={t('auth_files.weight_hint')}");
  });

  test.each(['en', 'zh-CN', 'zh-TW', 'ru'])(
    '%s keeps the tooltip as plain text matching the hint',
    (locale) => {
      const { auth_files: messages } = JSON.parse(
        readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
      ) as { auth_files: Record<string, string> };

      expect(messages.weight_tooltip).toBeTruthy();
      expect(messages.weight_tooltip).not.toMatch(/<[^>]+>/);
      expect(messages.weight_hint).not.toMatch(/<[^>]+>/);
      expect(messages.weight_strategy_note).toContain('<settingsLink>');
      expect(messages.weight_strategy_note).toContain('</settingsLink>');
      // 卡片提示以取值语义开头，后面接生效前提；两段都必须是纯文本。
      expect(messages.weight_tooltip.startsWith(messages.weight_hint)).toBe(true);
      expect(messages.weight_tooltip.length).toBeGreaterThan(messages.weight_hint.length);
    }
  );
});
