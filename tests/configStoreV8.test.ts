import { afterEach, describe, expect, test, spyOn } from 'bun:test';
import { configApi } from '../src/services/api/config';
import { useConfigStore } from '../src/stores/useConfigStore';
import type { Config } from '../src/types';

const originalGetConfig = configApi.getConfig;
afterEach(() => {
  configApi.getConfig = originalGetConfig;
  useConfigStore.getState().clearCache();
});

describe('v8 configuration cache', () => {
  test('reads one cached v8 snapshot and clears the document on invalidation', async () => {
    const raw = {
      'config-version': 8,
      observability: { logs: { 'request-log': false } },
      'api-keys': { codex: [{ name: 'group', keys: [{ 'api-key': 'fixture' }] }] },
    };
    const read = spyOn(configApi, 'getConfig').mockResolvedValue({ raw, requestLog: false });
    await Promise.all([
      useConfigStore.getState().fetchConfig(),
      useConfigStore.getState().fetchConfig(),
    ]);
    await useConfigStore.getState().fetchConfig();
    expect(read).toHaveBeenCalledTimes(1);
    expect(useConfigStore.getState().config?.raw).toEqual(raw);
    expect(useConfigStore.getState().isCacheValid()).toBe(true);
    useConfigStore.getState().clearCache();
    expect(useConfigStore.getState().config).toBeNull();
    expect(useConfigStore.getState().isCacheValid()).toBe(false);
  });

  test('an old connection cannot publish over a new v8 document', async () => {
    let resolveOld!: (value: Config) => void;
    const oldRequest = new Promise<Config>((resolve) => {
      resolveOld = resolve;
    });
    const current = { raw: { 'config-version': 8, access: { 'api-keys': ['new-fixture'] } } };
    const mock = spyOn(configApi, 'getConfig')
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce(current);
    const old = useConfigStore.getState().fetchConfig();
    useConfigStore.getState().clearCache();
    await useConfigStore.getState().fetchConfig();
    resolveOld({ raw: { access: { 'api-keys': ['old-fixture'] } } });
    await old;
    expect(mock).toHaveBeenCalledTimes(2);
    expect(useConfigStore.getState().config).toEqual(current);
  });
});
