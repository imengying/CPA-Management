import { afterEach, describe, expect, test } from 'bun:test';
import {
  buildThinkingFromLevels,
  readThinkingLevels,
} from '../src/features/providers/thinkingLevels';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';

const originalGet = apiClient.get;
const originalPut = apiClient.put;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

describe('provider thinking levels', () => {
  test('reads recognized levels plus legacy capability flags in selector order', () => {
    expect(
      readThinkingLevels({
        levels: ['HIGH', 'custom', 'low'],
        zero_allowed: true,
        dynamic_allowed: true,
      })
    ).toEqual(['none', 'low', 'high', 'auto']);
  });

  test('writes canonical backend order and omits an empty selection', () => {
    expect(buildThinkingFromLevels([])).toBeUndefined();
    expect(buildThinkingFromLevels(['auto', 'high', 'none', 'low'])).toEqual({
      levels: ['low', 'high', 'none', 'auto'],
    });
  });

  test('serializes thinking for common and Vertex provider model payloads', async () => {
    const writes: Array<{ url: string; data: unknown }> = [];
    apiClient.get = (async () => ({})) as typeof apiClient.get;
    apiClient.put = (async (url: string, data?: unknown) => {
      writes.push({ url, data });
      return undefined;
    }) as typeof apiClient.put;

    const thinking = { levels: ['low', 'high'] };
    await providersApi.createInteractionsKey({
      apiKey: 'interactions-key',
      models: [{ name: 'gemini-3.1-flash-lite', thinking }],
    });
    await providersApi.createVertexConfig({
      apiKey: 'vertex-key',
      models: [{ name: 'gemini-3.1-pro', alias: 'pro', thinking }],
    });

    expect(writes).toEqual([
      {
        url: '/interactions-api-key',
        data: [
          {
            'api-key': 'interactions-key',
            models: [{ name: 'gemini-3.1-flash-lite', thinking }],
          },
        ],
      },
      {
        url: '/vertex-api-key',
        data: [
          {
            'api-key': 'vertex-key',
            models: [{ name: 'gemini-3.1-pro', alias: 'pro', thinking }],
          },
        ],
      },
    ]);
  });
});
