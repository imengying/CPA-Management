import { useTranslation } from 'react-i18next';
import { IconLoader2, IconPlus, IconRefreshCw, IconSearch } from '@/components/ui/icons';
import type { ProviderRecentUsageMap } from '@/components/providers/utils';
import type { ProviderGroup, ProviderResource } from '../types';
import { ProviderResourceTable } from './ProviderResourceTable';
import { ProviderResourceToolbar } from './ProviderResourceToolbar';
import type { ProviderSortBy, SortDir } from '../types';
import styles from './ProviderResourcePanel.module.scss';

export interface ProviderPanelControls {
  sortBy: ProviderSortBy;
  sortDir: SortDir;
  onSortBy: (value: ProviderSortBy) => void;
  onSortDir: (value: SortDir) => void;
  availableModels: ReadonlyArray<string>;
  selectedModels: ReadonlySet<string>;
  onSelectedModelsChange: (next: Set<string>) => void;
}

interface ProviderResourcePanelProps {
  group: ProviderGroup;
  filter: string;
  onFilterChange: (value: string) => void;
  filteredResources: ProviderResource[];
  selectedId: string | null;
  isFetching?: boolean;
  disableMutations?: boolean;
  showCreateAction?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  toolbarControls?: ProviderPanelControls;
  onRefresh: () => void;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
  onCreate: () => void;
}

export function ProviderResourcePanel({
  group,
  filter,
  onFilterChange,
  filteredResources,
  selectedId,
  isFetching = false,
  disableMutations,
  showCreateAction = true,
  usageByProvider,
  toolbarControls,
  onRefresh,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
  onCreate,
}: ProviderResourcePanelProps) {
  const { t } = useTranslation();
  const hasProviderInfo = group.resources.some((r) => !r.flags.isPlaceholder);
  const showAmpcodeConfigure = group.id === 'ampcode' && !hasProviderInfo;
  let emptyText = t('providersPage.table.empty');
  if (showAmpcodeConfigure) {
    emptyText = t('providersPage.ampcode.empty');
  }
  const realResources = filteredResources.filter((r) => !r.flags.isPlaceholder);

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            className={styles.searchInput}
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder={t('providersPage.table.filterPlaceholder')}
          />
        </div>

        <div className={styles.toolbarActions}>
          {toolbarControls ? (
            <ProviderResourceToolbar
              key={group.id}
              sortBy={toolbarControls.sortBy}
              sortDir={toolbarControls.sortDir}
              onSortBy={toolbarControls.onSortBy}
              onSortDir={toolbarControls.onSortDir}
              availableModels={toolbarControls.availableModels}
              selectedModels={toolbarControls.selectedModels}
              onSelectedModelsChange={toolbarControls.onSelectedModelsChange}
            />
          ) : null}
          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionButtonOutline}`}
            onClick={onRefresh}
            disabled={isFetching}
            aria-label={
              isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')
            }
          >
            <span className={`${styles.buttonIcon} ${isFetching ? styles.spin : ''}`.trim()}>
              {isFetching ? <IconLoader2 size={16} /> : <IconRefreshCw size={16} />}
            </span>
            <span>
              {isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')}
            </span>
          </button>
          {showCreateAction ? (
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
              onClick={onCreate}
              disabled={disableMutations}
            >
              <IconPlus size={16} />
              <span>{t('providersPage.actions.new')}</span>
            </button>
          ) : null}
        </div>
      </div>

      {realResources.length === 0 ? (
        <div className={styles.empty}>
          <div>{emptyText}</div>
          <div className={styles.emptyAction}>
            <button type="button" className={styles.emptyActionButton} onClick={onCreate}>
              <IconPlus size={16} />
              <span>
                {showAmpcodeConfigure
                  ? t('providersPage.actions.configure')
                  : t('providersPage.actions.new')}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <ProviderResourceTable
          resources={filteredResources}
          selectedId={selectedId}
          disableMutations={disableMutations}
          usageByProvider={usageByProvider}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleDisabled={onToggleDisabled}
        />
      )}
    </section>
  );
}
