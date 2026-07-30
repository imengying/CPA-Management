import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw, IconUpload } from '@/components/ui/icons';
import { useRevealGroup } from '@/hooks/motion';
import styles from './VaultHeader.module.scss';

export type VaultHeaderProps = {
  totalCount: number;
  activeCount: number;
  problemCount: number;
  loading: boolean;
  refreshing: boolean;
  uploading: boolean;
  disableControls: boolean;
  onUpload: () => void;
  onRefresh: () => void;
};

export function VaultHeader(props: VaultHeaderProps) {
  const {
    totalCount,
    activeCount,
    problemCount,
    loading,
    refreshing,
    uploading,
    disableControls,
    onUpload,
    onRefresh,
  } = props;
  const { t } = useTranslation();
  const revealRef = useRevealGroup<HTMLElement>();

  return (
    <header className={styles.header} ref={revealRef}>
      <div className={styles.copy} data-reveal>
        <h1 className={styles.title}>{t('auth_files.title')}</h1>
        <p className={styles.meta}>
          <span>{t('auth_files.meta_total', { count: totalCount })}</span>
          <span className={styles.metaDot} aria-hidden="true">
            &middot;
          </span>
          <span className={activeCount > 0 ? styles.metaActive : styles.metaMuted}>
            {t('auth_files.meta_active', { count: activeCount })}
          </span>
          {problemCount > 0 && (
            <>
              <span className={styles.metaDot} aria-hidden="true">
                &middot;
              </span>
              <span className={styles.metaProblem}>
                {t('auth_files.meta_problem', { count: problemCount })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className={styles.actions} data-reveal>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={loading || refreshing}
          loading={refreshing}
        >
          {!refreshing && <IconRefreshCw size={14} />}
          {t('common.refresh')}
        </Button>
        <Button
          size="sm"
          onClick={onUpload}
          disabled={disableControls || uploading}
          loading={uploading}
        >
          {!uploading && <IconUpload size={15} />}
          {t('auth_files.upload_button')}
        </Button>
      </div>
    </header>
  );
}
