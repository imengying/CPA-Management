import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { IconPlus, IconRefreshCw, IconSearch } from '@/components/ui/icons';
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
  const createActionLabel = t('providersPage.actions.new');
  const emptyText = t('providersPage.table.empty', { action: createActionLabel });

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            type="search"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder={t('providersPage.table.filterPlaceholder')}
            aria-label={t('providersPage.table.filterPlaceholder')}
            rightElement={<IconSearch className={styles.searchIcon} size={16} />}
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
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            loading={isFetching}
            aria-label={
              isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')
            }
          >
            {!isFetching ? <IconRefreshCw size={14} /> : null}
            {isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')}
          </Button>
          {showCreateAction ? (
            <Button size="sm" onClick={onCreate} disabled={disableMutations}>
              <IconPlus size={15} />
              {t('providersPage.actions.new')}
            </Button>
          ) : null}
        </div>
      </div>

      {filteredResources.length === 0 ? (
        <EmptyState
          title={emptyText}
          action={
            showCreateAction ? (
              <Button size="sm" onClick={onCreate} disabled={disableMutations}>
                <IconPlus size={15} />
                {createActionLabel}
              </Button>
            ) : undefined
          }
        />
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
