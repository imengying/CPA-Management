/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 判断是否为普通对象（排除 null 与数组）
 */
export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  asRecord(value) !== null;

/**
 * 从 unknown 错误中提取可读消息
 */
export const getErrorMessage = (error: unknown, fallback = ''): string => {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  if (isRecord(error) && typeof error.message === 'string') return error.message || fallback;
  return fallback;
};

export const getErrorStatus = (error: unknown): number | undefined => {
  const status = asRecord(error)?.status;
  if (typeof status === 'number' && Number.isFinite(status)) return status;
  if (typeof status !== 'string' || !status.trim()) return undefined;
  const parsed = Number(status);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};
