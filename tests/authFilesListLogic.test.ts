import { describe, expect, test } from 'bun:test';
import {
  buildWildcardSearch,
  matchesAuthFileSearch,
  resolveAuthFileQuotaType,
  sortAuthFiles,
} from '../src/features/authFiles/logic';
import type { AuthFileItem } from '../src/types';

const authFile = (overrides: Partial<AuthFileItem> = {}): AuthFileItem => ({
  name: 'credential.json',
  type: 'codex',
  ...overrides,
});

const search = (file: AuthFileItem, term: string) =>
  matchesAuthFileSearch(file, term, buildWildcardSearch(term));

describe('buildWildcardSearch', () => {
  test('only builds wildcard expressions and escapes regex metacharacters', () => {
    expect(buildWildcardSearch('user@example.com')).toBeNull();
    const pattern = buildWildcardSearch('u+1*');
    expect(pattern?.test('u+1@x.com')).toBe(true);
    expect(pattern?.test('u1@x.com')).toBe(false);
  });
});

describe('resolveAuthFileQuotaType', () => {
  test('resolves each supported provider while the all tab is selected', () => {
    expect(resolveAuthFileQuotaType(authFile({ type: 'codex' }), 'all')).toBe('codex');
    expect(resolveAuthFileQuotaType(authFile({ type: 'kimi' }), 'all')).toBe('kimi');
  });

  test('does not expose quota for unsupported or mismatched providers', () => {
    expect(resolveAuthFileQuotaType(authFile({ type: 'gemini' }), 'all')).toBeNull();
    expect(resolveAuthFileQuotaType(authFile({ type: 'codex' }), 'claude')).toBeNull();
    expect(resolveAuthFileQuotaType(authFile({ type: 'codex' }), null)).toBeNull();
  });
});

describe('matchesAuthFileSearch', () => {
  test('matches ordinary and identity fields', () => {
    expect(matchesAuthFileSearch(authFile(), '', null)).toBe(true);
    expect(search(authFile({ name: 'codex-a.json' }), 'CODEX')).toBe(true);
    expect(search(authFile({ type: 'antigravity' }), 'antigrav')).toBe(true);
    expect(search(authFile({ type: undefined, provider: 'gemini' }), 'gemi')).toBe(true);
    expect(
      search(
        authFile({ name: 'kimi-1712345678901.json', type: 'kimi', email: 'user@example.com' }),
        'user@example'
      )
    ).toBe(true);
    expect(search(authFile({ name: 'vertex-x.json', projectId: 'my-proj' }), 'my-proj')).toBe(true);
    expect(
      search(authFile({ name: 'kimi-1712345678901.json', email: 'user@example.com' }), 'user@*com')
    ).toBe(true);
  });

  test('ignores account and malformed non-string identity fields', () => {
    const file = authFile({
      name: 'gemini-apikey.json',
      account: 'sk-live-abcd',
      account_type: 'api_key',
      email: ['sk-array-secret'] as unknown as string,
      projectId: { toString: null } as unknown as string,
    });
    expect(() => search(file, 'missing')).not.toThrow();
    expect(search(file, 'sk-live')).toBe(false);
    expect(search(file, 'sk-array')).toBe(false);
  });

  test('finds credentials by HTTP error code or error content', () => {
    const forbidden = authFile({ statusMessage: '403 Forbidden: invalid credentials' });
    const rateLimited = authFile({
      statusMessage: '{"error":{"code":429,"message":"Rate limit exceeded"}}',
    });
    expect(search(forbidden, '403')).toBe(true);
    expect(search(forbidden, 'INVALID')).toBe(true);
    expect(search(forbidden, '403 Forbidden: invalid credentials')).toBe(true);
    expect(search(forbidden, '429')).toBe(false);
    expect(search(rateLimited, '429')).toBe(true);
    expect(search(rateLimited, 'rate limit exceeded')).toBe(true);
  });

  test('uses the same status message as the card, including raw backend fields', () => {
    expect(search(authFile({ status_message: '403 Forbidden' }), '403')).toBe(true);
    expect(
      search(authFile({ status_message: '429 Too Many Requests', statusMessage: '403' }), '403')
    ).toBe(false);
  });

  test('supports wildcards in error content and treats regex punctuation literally', () => {
    const file = authFile({ statusMessage: '403: invalid_request (credentials)' });
    expect(search(file, '403*INVALID')).toBe(true);
    expect(search(file, 'invalid*(credentials)')).toBe(true);
    expect(search(file, 'invalid*[credentials]')).toBe(false);
  });

  test('does not search arbitrary credential metadata', () => {
    expect(search(authFile({ metadata: { secret: 'invalid-secret' } }), 'invalid')).toBe(false);
  });

  test('never matches the account field — it can be a raw API key', () => {
    expect(
      search(
        authFile({ name: 'gemini-apikey.json', account: 'sk-live-abcd', account_type: 'api_key' }),
        'sk-live'
      )
    ).toBe(false);
  });

  test('tolerates missing fields', () => {
    expect(search({ name: 'bare.json' }, 'zzz')).toBe(false);
  });
});

describe('sortAuthFiles', () => {
  test("'default' orders by provider then name", () => {
    const files = [
      authFile({ name: 'b.json', provider: 'kimi' }),
      authFile({ name: 'c.json', type: 'codex', provider: undefined }),
      authFile({ name: 'a.json', provider: 'kimi' }),
    ];
    expect(sortAuthFiles(files, 'default').map((file) => file.name)).toEqual([
      'c.json',
      'a.json',
      'b.json',
    ]);
  });

  test("'az' orders by the displayed primary row, not by the file name", () => {
    const files = [
      authFile({ name: 'zzz.json', email: 'aaa@example.com' }),
      authFile({ name: 'aaa.json', email: 'zzz@example.com' }),
    ];
    expect(sortAuthFiles(files, 'az').map((file) => file.name)).toEqual(['zzz.json', 'aaa.json']);
  });

  test("'priority' orders descending, treats missing values as 0 and stays stable on ties", () => {
    const files = [
      authFile({ name: 'a.json' }),
      authFile({ name: 'b.json', priority: 5 }),
      authFile({ name: 'c.json' }),
      authFile({ name: 'd.json', priority: 9 }),
    ];
    expect(sortAuthFiles(files, 'priority').map((file) => file.name)).toEqual([
      'd.json',
      'b.json',
      'a.json',
      'c.json',
    ]);
  });

  test('returns a new array and leaves the input untouched', () => {
    const files = [authFile({ name: 'b.json' }), authFile({ name: 'a.json' })];
    const result = sortAuthFiles(files, 'az');
    expect(result).not.toBe(files);
    expect(files.map((file) => file.name)).toEqual(['b.json', 'a.json']);
  });
});
