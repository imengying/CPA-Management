/**
 * 日志相关 API
 */

import { apiClient } from './client';
import { LOGS_TIMEOUT_MS } from '@/utils/constants';
import { isRecord } from '@/utils/helpers';

export interface LogsQuery {
  cursor?: string;
  limit?: number;
}

export interface LogsResponse {
  lines: string[];
  nextCursor?: string;
  cursorReset?: boolean;
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

const normalizeLogsResponse = (data: unknown): LogsResponse => {
  if (!isRecord(data) || !Array.isArray(data.lines)) {
    return { lines: [] };
  }

  return {
    lines: data.lines.filter((line): line is string => typeof line === 'string'),
    nextCursor: stringValue(data['next-cursor']) || undefined,
    cursorReset: booleanValue(data['cursor-reset']),
  };
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
