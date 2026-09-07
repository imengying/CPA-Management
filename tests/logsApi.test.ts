import { afterEach, describe, expect, test } from 'bun:test';
import { apiClient } from '../src/services/api/client';
import { logsApi } from '../src/services/api/logs';
import { LOGS_TIMEOUT_MS } from '../src/utils/constants';

const originalGet = apiClient.get;

afterEach(() => {
  apiClient.get = originalGet;
});

describe('logs API', () => {
  test('preserves cursor pagination and filters invalid log lines', async () => {
    let request: unknown;
    apiClient.get = (async (url: string, config?: unknown) => {
      request = { url, config };
      return {
        lines: ['first', null, 42, 'second'],
        'next-cursor': ' next-page ',
        'cursor-reset': ' TRUE ',
      };
    }) as typeof apiClient.get;

    expect(await logsApi.fetchLogs({ cursor: 'current-page', limit: 20 })).toEqual({
      lines: ['first', 'second'],
      nextCursor: 'next-page',
      cursorReset: true,
    });
    expect(request).toEqual({
      url: '/logs',
      config: {
        params: { cursor: 'current-page', limit: 20 },
        timeout: LOGS_TIMEOUT_MS,
      },
    });
  });

  test('returns an empty log list for malformed payloads', async () => {
    for (const payload of [null, undefined, [], {}, { lines: 'invalid', 'next-cursor': 'bad' }]) {
      apiClient.get = (async () => payload) as typeof apiClient.get;
      expect(await logsApi.fetchLogs()).toEqual({ lines: [] });
    }
  });

  test('preserves empty responses without inventing a cursor or reset', async () => {
    apiClient.get = (async () => ({
      lines: [],
      'next-cursor': ' ',
      'cursor-reset': false,
    })) as typeof apiClient.get;

    expect(await logsApi.fetchLogs()).toEqual({
      lines: [],
      nextCursor: undefined,
      cursorReset: false,
    });
  });
});
