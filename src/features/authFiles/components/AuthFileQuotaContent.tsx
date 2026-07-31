import { useTranslation } from 'react-i18next';
import type { AuthFileQuotaControls } from '@/features/authFiles/hooks/useAuthFileQuotaControls';
import { bindQuotaClasses } from '@/features/quota/types';
import styles from './AuthFileQuota.module.scss';

const compactQuotaClasses = bindQuotaClasses(styles, 'AuthFileQuota.module.scss');

export function AuthFileQuotaContent({
  controls,
  refreshDisabled,
}: {
  controls: AuthFileQuotaControls;
  refreshDisabled: boolean;
}) {
  const { t } = useTranslation();
  const {
    config,
    quota,
    quotaStatus,
    canUseRefreshQuota,
    refreshQuotaForFile,
    quotaErrorMessage,
    resetQuotaAction,
  } = controls;

  if (!config) return null;

  return (
    <div className={styles.quotaSection}>
      {quotaStatus === 'loading' ? (
        <div className={styles.quotaMessage}>{t(`${config.i18nPrefix}.loading`)}</div>
      ) : quotaStatus === 'idle' ? (
        <button
          type="button"
          className={`${styles.quotaMessage} ${styles.quotaMessageAction}`}
          onClick={() => void refreshQuotaForFile()}
          disabled={!canUseRefreshQuota || refreshDisabled}
          title={t('auth_files.quota_refresh_hint')}
        >
          {t(`${config.i18nPrefix}.idle`)}
        </button>
      ) : quotaStatus === 'error' ? (
        <div className={styles.quotaError}>
          {t(`${config.i18nPrefix}.load_failed`, {
            message: quotaErrorMessage,
          })}
        </div>
      ) : quota ? (
        <config.Body quota={quota} classes={compactQuotaClasses} />
      ) : (
        <div className={styles.quotaMessage}>{t(`${config.i18nPrefix}.idle`)}</div>
      )}
      {resetQuotaAction && <div className={styles.quotaCardActions}>{resetQuotaAction}</div>}
    </div>
  );
}
