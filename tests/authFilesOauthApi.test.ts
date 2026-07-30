import { afterEach, describe, expect, test } from 'bun:test';
import { authFilesApi } from '../src/services/api/authFiles';
import { apiClient } from '../src/services/api/client';

const originalPatch = apiClient.patch;
const originalDelete = apiClient.delete;

afterEach(() => {
  apiClient.patch = originalPatch;
  apiClient.delete = originalDelete;
});

describe('auth files OAuth API contract', () => {
  test('saves normalized aliases without dropping the payload', async () => {
    let request: { url: string; data: unknown } | null = null;
    apiClient.patch = (async (url: string, data?: unknown) => {
      request = { url, data };
      return undefined;
    }) as typeof apiClient.patch;

    await authFilesApi.saveOauthModelAlias('Codex', [
      { name: 'gpt-source', alias: 'gpt-alias', fork: true, forceMapping: false },
    ]);

    expect(request).toEqual({
      url: '/oauth-model-alias',
      data: {
        channel: 'codex',
        aliases: [
          {
            name: 'gpt-source',
            alias: 'gpt-alias',
            fork: true,
            'force-mapping': false,
          },
        ],
      },
    });
  });

  test('deletes aliases through the v7.2.104 PATCH contract only', async () => {
    const requests: Array<{ method: string; url: string; data?: unknown }> = [];
    apiClient.patch = (async (url: string, data?: unknown) => {
      requests.push({ method: 'PATCH', url, data });
      return undefined;
    }) as typeof apiClient.patch;
    apiClient.delete = (async (url: string) => {
      requests.push({ method: 'DELETE', url });
      return undefined;
    }) as typeof apiClient.delete;

    await authFilesApi.deleteOauthModelAlias('Codex');

    expect(requests).toEqual([
      {
        method: 'PATCH',
        url: '/oauth-model-alias',
        data: { channel: 'codex', aliases: [] },
      },
    ]);
  });
});
