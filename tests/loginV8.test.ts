import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import axios from 'axios';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConfigStore } from '@/stores/useConfigStore';

const spies: Array<{ mockRestore(): void }> = [];
const originalFetchConfig = useConfigStore.getState().fetchConfig;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const memory = new Map<string, string>();
beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { host: 'proxy.invalid' } },
  });
});
afterAll(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});
afterEach(() => {
  spies.splice(0).forEach((spy) => spy.mockRestore());
  // Zustand replaces its state object; mockRestore alone can leave the mocked action in new states.
  useConfigStore.setState({ fetchConfig: originalFetchConfig });
  useAuthStore.getState().logout();
  memory.clear();
});

const credentials = {
  apiBase: 'https://proxy.invalid/gateway',
  managementKey: 'fixture-only',
  rememberPassword: false,
};

describe('v8 backend login', () => {
  test.each([401, 404, 500])('preserves HTTP %s without probing another API', async (status) => {
    const error = Object.assign(new Error('request failed'), { status });
    spies.push(spyOn(useConfigStore.getState(), 'fetchConfig').mockRejectedValue(error));
    const probe = spyOn(axios, 'get').mockResolvedValue({ data: {} });
    spies.push(probe);

    await expect(useAuthStore.getState().login(credentials)).rejects.toBe(error);
    expect(probe).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().connectionStatus).toBe('error');
  });

  test('authenticates using the current v8 configuration', async () => {
    const fetchConfig = spyOn(useConfigStore.getState(), 'fetchConfig').mockResolvedValue({});
    spies.push(fetchConfig);
    await useAuthStore.getState().login(credentials);
    expect(fetchConfig).toHaveBeenCalledWith(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().connectionStatus).toBe('connected');
  });
});
