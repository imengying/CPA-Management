import { describe, expect, test } from 'bun:test';
import { deriveAuthFileIdentity } from '../src/features/authFiles/identity';
import type { AuthFileItem } from '../src/types';

const authFile = (overrides: Partial<AuthFileItem> = {}): AuthFileItem => ({
  name: 'credential.json',
  type: 'codex',
  ...overrides,
});

describe('deriveAuthFileIdentity', () => {
  test('leads with the account email and keeps the full name as the secondary row', () => {
    expect(
      deriveAuthFileIdentity(
        authFile({
          name: 'codex-abc12345-user@example.com-team.json',
          email: 'user@example.com',
        })
      )
    ).toEqual({
      primary: 'user@example.com',
      kind: 'email',
      secondary: 'codex-abc12345-user@example.com-team',
    });
  });

  test('falls back to the file name and drops the duplicate secondary row', () => {
    expect(
      deriveAuthFileIdentity(authFile({ name: 'kimi-1712345678901.json', type: 'kimi' }))
    ).toEqual({
      primary: 'kimi-1712345678901',
      kind: 'fileName',
      secondary: null,
    });
  });

  test('uses the project id when there is no email', () => {
    expect(
      deriveAuthFileIdentity(
        authFile({ name: 'vertex-my-proj.json', type: 'vertex', projectId: 'my-proj' })
      )
    ).toEqual({
      primary: 'my-proj',
      kind: 'projectId',
      secondary: 'vertex-my-proj',
    });
  });

  test('ignores malformed identity values and never surfaces account', () => {
    const identity = deriveAuthFileIdentity(
      authFile({
        name: 'gemini-apikey.json',
        type: 'gemini',
        email: 123 as unknown as string,
        projectId: ['sk-project-secret'] as unknown as string,
        account: 'sk-live-abcd1234',
        account_type: 'api_key',
      })
    );
    expect(identity.kind).toBe('fileName');
    expect(identity.primary).toBe('gemini-apikey');
    expect(JSON.stringify(identity)).not.toContain('sk-live');
  });

  test('suppresses the secondary row for runtime-only entries whose name is the account', () => {
    expect(
      deriveAuthFileIdentity(
        authFile({
          name: 'aistudio-channel-a',
          type: 'aistudio',
          email: 'aistudio-channel-a',
          runtimeOnly: true,
        })
      ).secondary
    ).toBeNull();
  });

  test('keeps the disambiguating secondary row for two credentials sharing one email', () => {
    const team = deriveAuthFileIdentity(
      authFile({ name: 'codex-abc12345-user@example.com-team.json', email: 'user@example.com' })
    );
    const plus = deriveAuthFileIdentity(
      authFile({ name: 'codex-abc12345-user@example.com-plus.json', email: 'user@example.com' })
    );
    expect(team.primary).toBe(plus.primary);
    expect(team.secondary).not.toBeNull();
    expect(team.secondary).not.toBe(plus.secondary);
  });
});
