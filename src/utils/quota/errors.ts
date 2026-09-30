import type { TFunction } from 'i18next';

export const resolveQuotaErrorMessage = (
  t: TFunction,
  status: number | undefined,
  fallback: string
): string => {
  if (status === 403) return t('common.quota_check_credential');
  return fallback;
};
