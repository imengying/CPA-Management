/**
 * 日志相关 API
 */

import { apiClient } from './client';
import { LOGS_TIMEOUT_MS } from '@/utils/constants';
import { isRecord } from '@/utils/helpers';

export type LogCursor = number | string;
export type LogBackendKind = 'unknown' | 'file';

export interface LogsQuery {
  after?: LogCursor;
  cursor?: string;
  limit?: number;
  offset?: number;
}

export interface CPALogsResponse {
  lines: string[];
  'line-count': number;
  'latest-timestamp': number;
}

export interface LogsResponse {
  lines: string[];
  lineCount: number;
  latestAfter?: LogCursor;
  nextCursor?: string;
  cursorReset?: boolean;
  logBackendKind: LogBackendKind;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface ErrorLogFile {
  name: string;
  size?: number;
  modified?: number;
}

export interface ErrorLogsResponse {
  files?: ErrorLogFile[];
}

const stringValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const booleanValue = (value: unknown): boolean =>
  value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');

const unixSecondsFromValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = stringValue(value);
  if (!text) return 0;
  const asNumber = Number(text);
  if (Number.isFinite(asNumber)) return asNumber;
  const asDate = Date.parse(text);
  return Number.isFinite(asDate) ? Math.floor(asDate / 1000) : 0;
};

const normalizeCPALogs = (data: Record<string, unknown>): LogsResponse => {
  const lines = Array.isArray(data.lines)
    ? data.lines.filter((line): line is string => typeof line === 'string')
    : [];
  const latestTimestamp = unixSecondsFromValue(data['latest-timestamp']);
  const lineCount = Number(data['line-count']);

  return {
    lines,
    lineCount: Number.isFinite(lineCount) ? lineCount : lines.length,
    latestAfter: latestTimestamp > 0 ? latestTimestamp : undefined,
    nextCursor: stringValue(data['next-cursor']) || undefined,
    cursorReset: booleanValue(data['cursor-reset']),
    logBackendKind: 'file',
  };
};

const normalizeLogsResponse = (data: unknown): LogsResponse => {
  if (!isRecord(data)) {
    return { lines: [], lineCount: 0, logBackendKind: 'unknown' };
  }
  if (Array.isArray(data.lines)) return normalizeCPALogs(data);
  return { lines: [], lineCount: 0, logBackendKind: 'unknown' };
};

export const logsApi = {
  async fetchLogs(params: LogsQuery = {}): Promise<LogsResponse> {
    const data = await apiClient.get('/logs', { params, timeout: LOGS_TIMEOUT_MS });
    return normalizeLogsResponse(data);
  },

  clearLogs: () => apiClient.delete('/logs'),

  fetchErrorLogs: (): Promise<ErrorLogsResponse> =>
    apiClient.get('/request-error-logs', { timeout: LOGS_TIMEOUT_MS }),

  downloadErrorLog: (filename: string) =>
    apiClient.getRaw(`/request-error-logs/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
      timeout: LOGS_TIMEOUT_MS,
    }),

  downloadRequestLogById: (id: string) =>
    apiClient.getRaw(`/request-log-by-id/${encodeURIComponent(id)}`, {
      responseType: 'blob',
      timeout: LOGS_TIMEOUT_MS,
    }),
};
