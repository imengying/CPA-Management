import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/**
 * 卡片上的 weight 提示是原生 title 属性，只能承载纯文本；
 * 详情面板里的 weight_hint 需要保留 <settingsLink> 供 <Trans> 渲染链接。
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

  test('the details sheet keeps the link-bearing hint for <Trans>', () => {
    const detailsSource = readFileSync(
      new URL('../src/features/authFiles/components/AuthFileDetailsSheet.tsx', import.meta.url),
      'utf8'
    );
    expect(detailsSource).toContain('i18nKey="auth_files.weight_hint"');
  });

  test.each(['en', 'zh-CN', 'zh-TW', 'ru'])(
    '%s keeps the tooltip as plain text matching the hint',
    (locale) => {
      const { auth_files: messages } = JSON.parse(
        readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
      ) as { auth_files: Record<string, string> };

      expect(messages.weight_tooltip).toBeTruthy();
      expect(messages.weight_tooltip).not.toMatch(/<[^>]+>/);
      expect(messages.weight_hint).toContain('<settingsLink>');
      expect(messages.weight_hint).toContain('</settingsLink>');
      expect(messages.weight_tooltip).toBe(
        messages.weight_hint.replace(/<\/?settingsLink>/g, '')
      );
    }
  );
});
