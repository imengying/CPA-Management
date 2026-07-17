import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/ui/Collapsible';
import { IconCheck, IconX } from '@/components/ui/icons';
import { getProviderTotalStats, type ProviderRecentUsageMap } from '@/components/providers/utils';
import type { OpenAIProviderConfig } from '@/types';
import { maskApiKey } from '@/utils/format';
import type { ProviderResource } from '../types';
import styles from './forms/sharedForm.module.scss';

interface ResourceDetailViewProps {
  resource: ProviderResource;
  usageByProvider?: ProviderRecentUsageMap;
}

export function ResourceDetailView({ resource, usageByProvider }: ResourceDetailViewProps) {
  const { t } = useTranslation();

  const primary: Array<[string, string]> = [
    ['identifier', resource.identifier],
    ['baseUrl', resource.baseUrl ?? t('providersPage.status.notSet')],
    ['proxyUrl', resource.proxyUrl ?? t('providersPage.status.notSet')],
    ['prefix', resource.prefix ?? t('providersPage.status.none')],
    ['models', String(resource.modelCount)],
    ['headers', String(resource.headerCount)],
  ];

  const metadata: Array<[string, string]> = [
    ['authIndex', resource.authIndex ?? t('providersPage.status.notSet')],
    ['excludedModels', String(resource.excludedModelCount)],
    ['apiKeyEntries', String(resource.apiKeyEntryCount)],
  ];

  const openaiConfig =
    resource.brand === 'openaiCompatibility' ? (resource.raw as OpenAIProviderConfig) : null;
  const apiKeyEntries = openaiConfig?.apiKeyEntries ?? [];

  return (
    <div>
      <dl className={styles.dl}>
        {primary.map(([key, value]) => (
          <div key={key}>
            <dt className={styles.dt}>{t(`providersPage.detail.fields.${key}`)}</dt>
            <dd className={styles.dd}>{value}</dd>
          </div>
        ))}
      </dl>

      {openaiConfig && apiKeyEntries.length > 0 ? (
        <div className={styles.detailSection}>
          <Collapsible
            label={`${t('providersPage.form.apiKeyEntriesSection')}: ${apiKeyEntries.length}`}
          >
            <div className={styles.entriesList}>
              {apiKeyEntries.map((entry, entryIndex) => {
                const entryStats = usageByProvider
                  ? getProviderTotalStats(
                      usageByProvider,
                      openaiConfig.name,
                      entry.apiKey,
                      openaiConfig.baseUrl
                    )
                  : { success: 0, failure: 0 };
                return (
                  <div key={`${entry.apiKey}-${entryIndex}`} className={styles.entryCard}>
                    <div className={styles.entryCardHeader}>
                      <span className={styles.entryBadge}>#{entryIndex + 1}</span>
                      <span className={styles.entrySummaryKey}>{maskApiKey(entry.apiKey)}</span>
                      <div className={styles.entryCardHeaderRight}>
                        <span className={`${styles.entryBadge} ${styles.statusIconSuccess}`}>
                          <IconCheck size={12} /> {entryStats.success}
                        </span>
                        <span className={`${styles.entryBadge} ${styles.statusIconError}`}>
                          <IconX size={12} /> {entryStats.failure}
                        </span>
                      </div>
                    </div>
                    {entry.proxyUrl ? (
                      <div className={styles.entryCardBody}>
                        <dl className={styles.dl}>
                          <div>
                            <dt className={styles.dt}>{t('providersPage.form.proxyUrl')}</dt>
                            <dd className={styles.dd}>{entry.proxyUrl}</dd>
                          </div>
                        </dl>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Collapsible>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Collapsible label={t('providersPage.detail.metadataTitle')}>
          <dl className={styles.dl}>
            {metadata.map(([key, value]) => (
              <div key={key}>
                <dt className={styles.dt}>{t(`providersPage.detail.fields.${key}`)}</dt>
                <dd className={styles.dd}>{value}</dd>
              </div>
            ))}
          </dl>
        </Collapsible>
      </div>
    </div>
  );
}
