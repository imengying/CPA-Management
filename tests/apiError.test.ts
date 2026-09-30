import { describe, expect, test } from 'bun:test';
import { parseApiErrorResponse } from '../src/services/api/apiError';
import { getErrorStatus } from '../src/utils/helpers';
import { resolveQuotaErrorMessage } from '../src/utils/quota/errors';
import i18n from '../src/i18n';

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

  test('falls back to an endpoint string error', () => {
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

describe('quota error messages', () => {
  const t = i18n.getFixedT('en');

  test('preserves 404 details instead of treating them as an old backend', () => {
    expect(resolveQuotaErrorMessage(t, 404, 'Quota resource not found')).toBe(
      'Quota resource not found'
    );
  });

  test('keeps the credential hint for denied requests', () => {
    expect(resolveQuotaErrorMessage(t, 403, 'Forbidden')).toBe(t('common.quota_check_credential'));
  });

  test('preserves network and server failures', () => {
    expect(resolveQuotaErrorMessage(t, undefined, 'Network Error')).toBe('Network Error');
    expect(resolveQuotaErrorMessage(t, 500, 'Provider unavailable')).toBe('Provider unavailable');
  });
});
