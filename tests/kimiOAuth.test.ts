import { describe, expect, spyOn, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { apiClient } from '@/services/api/client';
import { oauthApi } from '@/services/api/oauth';
import { createOAuthAttempts } from '@/pages/oauthAttempts';

const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ru'] as const;

const OAuthPageSource = readFileSync(new URL('../src/pages/OAuthPage.tsx', import.meta.url), 'utf8');

const messagesFor = (locale: (typeof LOCALES)[number]): Record<string, string> =>
  (
    JSON.parse(
      readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
    ) as { auth_login: Record<string, string> }
  ).auth_login;

/**
 * Kimi 国内站（kimi.com）与国际站（kimi.ai）是两套独立账号体系，
 * 必须走各自的管理端点并保持登录尝试互不干扰。
 *
 * 刻意不覆盖推广/返利链接：本地 fork 不保留上游的注册引导入口。
 */
describe('Kimi regional login', () => {
  test('uses separate management endpoints and preserves cancellation', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue({ url: 'https://example.test' });
    const controller = new AbortController();
    try {
      await oauthApi.startAuth('kimi', controller.signal);
      expect(get).toHaveBeenLastCalledWith('/kimi-auth-url', {
        params: undefined,
        signal: controller.signal,
      });
      await oauthApi.startAuth('kimi-ai', controller.signal);
      expect(get).toHaveBeenLastCalledWith('/kimi-ai-auth-url', {
        params: undefined,
        signal: controller.signal,
      });
    } finally {
      get.mockRestore();
    }
  });

  test('keeps regional login attempts independent', () => {
    const attempts = createOAuthAttempts({ setTimeout: () => 0, clearTimeout: () => {} });
    try {
      const china = attempts.begin('kimi');
      const international = attempts.begin('kimi-ai');
      attempts.begin('kimi-ai');
      expect(china.signal.aborted).toBe(false);
      expect(international.signal.aborted).toBe(true);
    } finally {
      attempts.invalidateAll();
    }
  });

  test('exposes both regional providers as built-in cards', () => {
    expect(OAuthPageSource).toContain("id: 'kimi'");
    expect(OAuthPageSource).toContain("id: 'kimi-ai'");

    for (const locale of LOCALES) {
      const messages = messagesFor(locale);
      for (const key of ['kimi_oauth_title', 'kimi_oauth_hint']) {
        expect(messages[key]).toBeTruthy();
      }
      // 国际站的每个键都要有，且需有对应的国内站键，否则卡片会串用标签。
      for (const key of [
        'kimi_ai_oauth_title',
        'kimi_ai_oauth_button',
        'kimi_ai_oauth_hint',
        'kimi_ai_oauth_start_error',
        'kimi_ai_oauth_polling_error',
      ]) {
        expect(messages[key]).toBeTruthy();
        expect(messages[key.replace('kimi_ai_', 'kimi_')]).toBeTruthy();
      }
    }
  });

  test('does not ship the upstream sign-up referral entry', () => {
    expect(OAuthPageSource).not.toContain('sign_up');
    expect(OAuthPageSource).not.toContain('affiliate');
    for (const locale of LOCALES) {
      expect(messagesFor(locale).kimi_sign_up_button).toBeUndefined();
    }
  });
});
