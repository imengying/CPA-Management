import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import { useQuotaStore } from '@/stores';
import type { AuthFileItem } from '@/types';
import { isRuntimeOnlyAuthFile, type QuotaProviderType } from '@/features/authFiles/constants';
import { useQuotaActions } from '@/features/quota/hooks/useQuotaActions';
import { QUOTA_ADAPTERS, type QuotaCardState } from '@/features/quota/providers';
import type { QuotaStore } from '@/features/quota/providers/types';
import { resolveQuotaErrorMessage } from '@/utils/quota';
import styles from '@/features/authFiles/components/AuthFileQuota.module.scss';

type AuthFileQuotaControlProps = {
  file: AuthFileItem;
  quotaType: QuotaProviderType | null;
  disableControls: boolean;
};

export function useAuthFileQuotaControls(props: AuthFileQuotaControlProps) {
  const { file, quotaType, disableControls } = props;
  const { t } = useTranslation();
  const adapter = quotaType ? QUOTA_ADAPTERS[quotaType] : null;
  const runtimeOnly = isRuntimeOnlyAuthFile(file);
  const { resettingQuotaName, refreshQuota, resetQuota } = useQuotaActions(disableControls);
  const resettingQuota = resettingQuotaName === file.name;

  const quota = useQuotaStore((state) =>
    adapter ? adapter.storeSelector(state as unknown as QuotaStore)[file.name] : undefined
  );

  const refreshQuotaForFile = useCallback(async () => {
    if (!adapter || runtimeOnly) return;
    await refreshQuota(file, adapter);
  }, [adapter, file, refreshQuota, runtimeOnly]);

  const resetQuotaForFile = useCallback(() => {
    if (!adapter || runtimeOnly) return;
    resetQuota(file, adapter);
  }, [adapter, file, resetQuota, runtimeOnly]);

  const quotaStatus = quota?.status ?? 'idle';
  const quotaLoading = quotaStatus === 'loading';
  const canUseQuotaAction =
    !disableControls && !runtimeOnly && !file.disabled && !resettingQuota && !quotaLoading;
  const showResetQuotaAction = quota !== undefined && Boolean(adapter?.canResetQuota?.(quota));
  const resetQuotaAction =
    adapter?.resetQuota && showResetQuotaAction ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={styles.quotaResetCreditButton}
        onClick={() => resetQuotaForFile()}
        disabled={!canUseQuotaAction}
        loading={resettingQuota}
        title={t('codex_quota.reset_button')}
        aria-label={t('codex_quota.reset_button')}
      >
        {!resettingQuota && <IconRefreshCw size={14} />}
        {t('codex_quota.reset_button')}
      </Button>
    ) : undefined;

  const quotaErrorMessage = adapter
    ? resolveQuotaErrorMessage(t, quota?.errorStatus, quota?.error || t('common.unknown_error'))
    : '';

  return {
    config: adapter,
    quota: quota as QuotaCardState | undefined,
    quotaStatus,
    quotaLoading,
    canUseRefreshQuota: canUseQuotaAction,
    refreshQuotaForFile,
    resetQuotaAction,
    quotaErrorMessage,
  };
}

export type AuthFileQuotaControls = ReturnType<typeof useAuthFileQuotaControls>;
