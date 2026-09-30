import { afterEach, describe, expect, test } from 'bun:test';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import { openaiToResource } from '../src/features/providers/adapters';
import {
  normalizeConfigResponse,
  normalizeGeminiKeyConfig,
  normalizeOpenAIProvider,
  normalizeProviderKeyConfig,
} from '../src/services/api/transformers';

const originalGet = apiClient.get;
const originalPut = apiClient.put;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

describe('provider credential weight normalization', () => {
  test('reads weight for direct API key credentials', () => {
    expect(normalizeGeminiKeyConfig({ 'api-key': 'gemini-key', weight: 5 })?.weight).toBe(5);
    expect(normalizeProviderKeyConfig({ 'api-key': 'provider-key', weight: 0 })?.weight).toBe(0);
  });

  test('reads per-key weight for OpenAI-compatible providers', () => {
    const provider = normalizeOpenAIProvider({
      name: 'example',
      'base-url': 'https://example.com/v1',
      keys: [{ 'api-key': 'key-a', weight: 3 }, { 'api-key': 'key-b' }],
    });

    expect(provider?.apiKeyEntries[0]?.weight).toBe(3);
    expect(provider?.apiKeyEntries[1]?.weight).toBeUndefined();
  });

  test('preserves backend indexes when invalid OpenAI entries are filtered', async () => {
    const groups = [
      { 'base-url': 'https://invalid.example.com/v1', keys: [] },
      {
        name: 'first-valid',
        'base-url': 'https://first.example.com/v1',
        keys: [{ 'api-key': 'key-a' }],
      },
      {
        name: 'second-valid',
        'base-url': 'https://second.example.com/v1',
        keys: [{ 'api-key': 'key-b' }],
      },
    ];
    apiClient.get = (async () => ({
      'api-keys': { 'openai-compatibility': groups },
    })) as typeof apiClient.get;

    const providers =
      normalizeConfigResponse(await apiClient.get('/config')).openaiCompatibility ?? [];
    expect(providers.map((provider) => provider.sourceIndex)).toEqual([1, 2]);
    expect(openaiToResource(providers[0]!, 0).selector).toEqual({
      brand: 'openaiCompatibility',
      name: 'first-valid',
      index: 1,
    });

    const config = normalizeConfigResponse({ 'api-keys': { 'openai-compatibility': groups } });
    expect(config.openaiCompatibility?.map((provider) => provider.sourceIndex)).toEqual([1, 2]);
  });

  test('normalizes OAuth exclusions from the v8 config shape', () => {
    const config = normalizeConfigResponse({
      oauth: { 'excluded-models': { Codex: ['gpt-5', ' gpt-5 ', 'gpt-5-mini'] } },
    });

    expect(config.oauthExcludedModels).toEqual({ codex: ['gpt-5', 'gpt-5-mini'] });
  });

  test('removes a cleared Vertex weight while preserving unknown fields', async () => {
    let written: unknown;
    apiClient.get = (async () => ({
      'api-keys': {
        vertex: [
          {
            name: 'vertex-1',
            'base-url': 'https://vertex.example',
            keys: [{ 'api-key': 'vertex-key', weight: 9, 'future-field': 'keep' }],
          },
        ],
      },
    })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, data?: unknown) => {
      written = data;
      return undefined;
    }) as typeof apiClient.put;

    await providersApi.updateVertexConfig('vertex-key', 'https://vertex.example', {
      apiKey: 'vertex-key',
      baseUrl: 'https://vertex.example',
      weight: undefined,
    });

    expect(written).toEqual([
      {
        name: 'vertex-1',
        'base-url': 'https://vertex.example',
        keys: [{ 'api-key': 'vertex-key', 'future-field': 'keep' }],
      },
    ]);
  });

  test('writes and clears nested OpenAI-compatible key weights', async () => {
    let written: unknown;
    apiClient.get = (async () => ({
      'api-keys': {
        'openai-compatibility': [
          {
            name: 'example',
            'base-url': 'https://example.com/v1',
            keys: [
              { 'api-key': 'key-a', weight: 8, custom: 'keep-a' },
              { 'api-key': 'key-b', custom: 'keep-b' },
            ],
          },
        ],
      },
    })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, data?: unknown) => {
      written = data;
      return undefined;
    }) as typeof apiClient.put;

    const current = (normalizeConfigResponse(await apiClient.get('/config')).openaiCompatibility ??
      [])[0];
    await providersApi.updateOpenAIProvider('example', 0, {
      ...current,
      apiKeyEntries: [
        { ...current.apiKeyEntries[0], weight: undefined },
        { ...current.apiKeyEntries[1], weight: 4 },
      ],
    });

    expect(written).toEqual([
      {
        name: 'example',
        'base-url': 'https://example.com/v1',
        keys: [
          { 'api-key': 'key-a', custom: 'keep-a' },
          { 'api-key': 'key-b', custom: 'keep-b', weight: 4 },
        ],
      },
    ]);
  });
});
