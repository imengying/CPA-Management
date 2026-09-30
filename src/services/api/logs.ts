/**
 * 日志相关 API
 */

import type { ApiError } from '@/types';
import { apiClient } from './client';
import { parseApiErrorResponse } from './apiError';
import { LOGS_TIMEOUT_MS } from '@/utils/constants';
import { isRecord } from '@/utils/helpers';
import { parseTimestampMs } from '@/utils/timestamp';

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
  files: ErrorLogFile[];
}

const booleanValue = (value: unknown): boolean =>
  value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');

const unixSecondsFromValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const timestamp = parseTimestampMs(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : undefined;
};

const normalizeLogsResponse = (data: unknown): LogsResponse => {
  if (!isRecord(data) || !Array.isArray(data.lines)) {
    return { lines: [] };
  }

  return {
    lines: data.lines.filter((line): line is string => typeof line === 'string'),
    nextCursor: typeof data['next-cursor'] === 'string' ? data['next-cursor'] : undefined,
    cursorReset: booleanValue(data['cursor-reset']),
  };
};

export interface LogsRequestOptions {
  signal?: AbortSignal;
}

const normalizeErrorLogsResponse = (data: unknown): ErrorLogsResponse => {
  if (!isRecord(data) || !Array.isArray(data.files)) return { files: [] };
  return {
    files: data.files.flatMap((file): ErrorLogFile[] => {
      if (!isRecord(file) || typeof file.name !== 'string' || !file.name.trim()) return [];
      return [
        {
          name: file.name,
          size:
            typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0
              ? file.size
              : undefined,
          modified: unixSecondsFromValue(file.modified),
        },
      ];
    }),
  };
};

/** Decode download bodies without interpreting successful log contents as API errors. */
export const responseDataToText = async (data: unknown): Promise<string> => {
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }
  if (typeof data === 'string') return data;
  if (data === undefined || data === null) return '';
  try {
    return JSON.stringify(data, null, 2) ?? String(data);
  } catch {
    return String(data);
  }
};

const downloadLog = async (path: string, options: LogsRequestOptions) => {
  try {
    return await apiClient.getRaw(path, {
      ...options,
      responseType: 'blob',
      timeout: LOGS_TIMEOUT_MS,
    });
  } catch (error: unknown) {
    // The client already emitted unauthorized on 401 and normalized the Axios error.
    // It retains the body in data/details, NOT response.data. Preserve its identity,
    // status, transport code and body while enriching the human-readable error.
    if (error instanceof Error) {
      const apiError = error as ApiError;
      const body = apiError.data instanceof Blob ? apiError.data : apiError.details;
      if (body instanceof Blob) {
        try {
          const text = await responseDataToText(body);
          const parsed = parseApiErrorResponse(JSON.parse(text), apiError.message);
          apiError.message = parsed.message;
          if (parsed.apiCode !== undefined) apiError.apiCode = parsed.apiCode;
        } catch {
          // Unreadable/non-JSON bodies must not mask the original transport failure.
        }
      }
    }
    throw error;
  }
};

export const logsApi = {
  async fetchLogs(params: LogsQuery = {}, options: LogsRequestOptions = {}): Promise<LogsResponse> {
    const data = await apiClient.get('/observability/logs', {
      ...options,
      params,
      timeout: LOGS_TIMEOUT_MS,
    });
    return normalizeLogsResponse(data);
  },

  clearLogs: (options: LogsRequestOptions = {}) => apiClient.delete('/observability/logs', options),

  async fetchErrorLogs(options: LogsRequestOptions = {}): Promise<ErrorLogsResponse> {
    const data = await apiClient.get('/observability/logs/errors', {
      ...options,
      timeout: LOGS_TIMEOUT_MS,
    });
    return normalizeErrorLogsResponse(data);
  },

  downloadErrorLog: (filename: string, options: LogsRequestOptions = {}) =>
    downloadLog(`/observability/logs/errors/${encodeURIComponent(filename)}`, options),

  downloadRequestLogById: (id: string, options: LogsRequestOptions = {}) =>
    downloadLog(`/observability/logs/requests/${encodeURIComponent(id)}`, options),
};
