import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { readQuotaUiState, writeQuotaUiState } from '@/features/quota/uiState';

const KEY = 'quotaPage.uiState';
const originalWindow = (globalThis as { window?: unknown }).window;

function installSessionStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  (globalThis as unknown as { window: unknown }).window = { sessionStorage: storage };
  return storage;
}

let storage: ReturnType<typeof installSessionStorage>;

beforeEach(() => {
  storage = installSessionStorage();
});

afterAll(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = originalWindow;
});

describe('quota ui state', () => {
  test('round-trips preferences and preserves fields on partial writes', () => {
    writeQuotaUiState({ sortMode: 'soonest' });
    writeQuotaUiState({ tab: 'kimi' });
    expect(readQuotaUiState()).toEqual({ tab: 'kimi', sortMode: 'soonest' });
  });

  test('rejects unsupported values and malformed payloads', () => {
    storage.setItem(KEY, JSON.stringify({ tab: 'invalid', sortMode: 'invalid' }));
    expect(readQuotaUiState()).toEqual({ tab: undefined, sortMode: undefined });

    storage.setItem(KEY, '{invalid');
    expect(readQuotaUiState()).toBeNull();
  });
});
