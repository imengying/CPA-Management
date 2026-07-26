import { describe, expect, test } from 'bun:test';
import { parseApiErrorResponse } from '../src/services/api/apiError';
import { getErrorStatus } from '../src/utils/helpers';

describe('Management API error parsing', () => {
  test('prefers the human-readable message and preserves the API error code', () => {
    const result = parseApiErrorResponse(
      {
        error: 'plugin_install_failed',
        message: 'download plugin archive: 404 Not Found',
      },
      'Request failed with status code 502'
    );

    expect(result).toEqual({
      message: 'download plugin archive: 404 Not Found',
      apiCode: 'plugin_install_failed',
    });
  });

  test('falls back to a string error used by legacy endpoints', () => {
    expect(parseApiErrorResponse({ error: 'invalid body' }, 'Bad Request')).toEqual({
      message: 'invalid body',
      apiCode: 'invalid body',
    });
  });

  test('supports nested error messages and codes', () => {
    expect(
      parseApiErrorResponse(
        { error: { code: 'invalid_config', message: 'plugins-dir is invalid' } },
        'Bad Request'
      )
    ).toEqual({
      message: 'plugins-dir is invalid',
      apiCode: 'invalid_config',
    });
  });

  test('uses a text response body before the transport fallback', () => {
    expect(parseApiErrorResponse('upstream unavailable', 'Network Error')).toEqual({
      message: 'upstream unavailable',
    });
  });

  test('uses the transport message for an unknown response shape', () => {
    expect(parseApiErrorResponse({ error: null }, 'Network Error')).toEqual({
      message: 'Network Error',
      apiCode: undefined,
    });
  });
});

describe('API error status parsing', () => {
  test('reads numeric and numeric-string status values', () => {
    expect(getErrorStatus({ status: 404 })).toBe(404);
    expect(getErrorStatus({ status: '405' })).toBe(405);
  });

  test('ignores missing and invalid status values', () => {
    expect(getErrorStatus(null)).toBeUndefined();
    expect(getErrorStatus({ status: '' })).toBeUndefined();
    expect(getErrorStatus({ status: 'not-a-status' })).toBeUndefined();
  });
});
