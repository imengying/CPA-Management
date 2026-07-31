import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconPlus, IconRefreshCw } from '@/components/ui/icons';
import styles from './ProviderHeaderCard.module.scss';

interface ProviderHeaderCardProps {
  totalActive: number;
  totalResources: number;
  providerFamilies: number;
  updatedAtLabel: string;
  isFetching?: boolean;
  isNewDisabled?: boolean;
  showNewAction?: boolean;
  onRefresh: () => void;
  onNew: () => void;
}

export function ProviderHeaderCard({
  totalActive,
  totalResources,
  providerFamilies,
  updatedAtLabel,
  isFetching = false,
  isNewDisabled = false,
  showNewAction = true,
  onRefresh,
  onNew,
}: ProviderHeaderCardProps) {
  const { t } = useTranslation();

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title}>{t('providersPage.header.title')}</h1>
        <div className={styles.summary} aria-live="polite">
          <span className={styles.summaryPrimary}>
            {t('providersPage.header.activeResources', {
              active: totalActive,
              total: totalResources,
            })}
          </span>
          <span>{t('providersPage.header.providerFamilies', { count: providerFamilies })}</span>
          <span>{t('providersPage.header.updatedAt', { time: updatedAtLabel })}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={onRefresh} loading={isFetching}>
          {!isFetching ? <IconRefreshCw size={16} /> : null}
          {isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')}
        </Button>
        {showNewAction ? (
          <Button size="sm" onClick={onNew} disabled={isNewDisabled}>
            <IconPlus size={16} />
            {t('providersPage.actions.new')}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
