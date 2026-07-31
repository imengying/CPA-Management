import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import { useCountUp } from '@/hooks/motion';
import styles from './QuotaHeader.module.scss';

export type QuotaHeaderProps = {
  totalCount: number;
  loadedCount: number;
  attentionCount: number;
  refreshing: boolean;
  disableControls: boolean;
  onRefreshAll: () => void;
};

/** 额度页头部；入场顺序由页面壳的 useRevealGroup 统一编排。 */
export function QuotaHeader(props: QuotaHeaderProps) {
  const { totalCount, loadedCount, attentionCount, refreshing, disableControls, onRefreshAll } =
    props;
  const { t } = useTranslation();
  // 批量结果陆续落地时，「已加载」是页面上唯一滚动的数字
  const displayLoadedCount = useCountUp(loadedCount);

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title} data-reveal>
          {t('quota_management.title')}
        </h1>
        <p className={styles.meta} data-reveal>
          <span className={styles.metaTotal}>
            {t('quota_management.meta_credentials', { count: totalCount })}
          </span>
          <span className={styles.metaDot} aria-hidden="true">
            ·
          </span>
          <span className={loadedCount > 0 ? styles.metaLoaded : styles.metaMuted}>
            {t('quota_management.meta_loaded', { count: displayLoadedCount })}
          </span>
          {attentionCount > 0 && (
            <>
              <span className={styles.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.metaAttention}>
                {t('quota_management.meta_attention', { count: attentionCount })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className={styles.actions} data-reveal>
        <Button
          size="sm"
          onClick={onRefreshAll}
          disabled={disableControls || refreshing}
          loading={refreshing}
        >
          {!refreshing ? <IconRefreshCw size={14} /> : null}
          {t('quota_management.refresh_all_credentials')}
        </Button>
      </div>
    </header>
  );
}
