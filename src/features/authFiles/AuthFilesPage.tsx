import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { usePageTransitionLayer } from '@/components/common/PageTransitionLayer';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useInterval } from '@/hooks/useInterval';
import { useRevealOnScroll } from '@/hooks/motion';
import { useAuthStore, useNotificationStore, useThemeStore } from '@/stores';
import type { ResolvedTheme } from '@/types';
import { copyToClipboard } from '@/utils/clipboard';
import { invalidateAuthFileDerivedCaches } from '@/features/authFiles/cacheInvalidation';
import {
  QUOTA_PROVIDER_TYPES,
  clampCardPageSize,
  getTypeLabel,
  isProblemAuthFile,
  isRuntimeOnlyAuthFile,
  normalizeProviderKey,
  parsePriorityValue,
  type QuotaProviderType,
} from '@/features/authFiles/constants';
import { AuthFileCard } from '@/features/authFiles/components/AuthFileCard';
import { AuthFileDetailsSheet } from '@/features/authFiles/components/AuthFileDetailsSheet';
import { AuthFileModelsModal } from '@/features/authFiles/components/AuthFileModelsModal';
import { AuthFilesToolbar } from '@/features/authFiles/components/AuthFilesToolbar';
import { BatchActionBar } from '@/features/authFiles/components/BatchActionBar';
import { OAuthExcludedCard } from '@/features/authFiles/components/OAuthExcludedCard';
import { OAuthModelAliasCard } from '@/features/authFiles/components/OAuthModelAliasCard';
import { ProviderTabs } from '@/features/authFiles/components/ProviderTabs';
import { VaultHeader } from '@/features/authFiles/components/VaultHeader';
import { useAuthFilesData } from '@/features/authFiles/hooks/useAuthFilesData';
import { useAuthFilesModels } from '@/features/authFiles/hooks/useAuthFilesModels';
import { useAuthFilesOauth } from '@/features/authFiles/hooks/useAuthFilesOauth';
import { useAuthFilesPrefixProxyEditor } from '@/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import { useAuthFilesStatusBarCache } from '@/features/authFiles/hooks/useAuthFilesStatusBarCache';
import {
  isAuthFilesSortMode,
  isAuthFilesStatusFilterMode,
  readAuthFilesUiState,
  writeAuthFilesUiState,
  type AuthFilesSortMode,
  type AuthFilesStatusFilterMode,
} from '@/features/authFiles/uiState';
import styles from './AuthFilesPage.module.scss';

const DEFAULT_REGULAR_PAGE_SIZE = 9;
const DEFAULT_COMPACT_PAGE_SIZE = 12;
const SKELETON_CARD_COUNT = 6;
const CARD_ENTRANCE_BUDGET_MS = 360;

const escapeWildcardSearchSegment = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildWildcardSearch = (value: string): RegExp | null => {
  if (!value.includes('*')) return null;
  return new RegExp(value.split('*').map(escapeWildcardSearchSegment).join('.*'), 'i');
};

type AuthFilesPageInitialState = {
  filter: string;
  statusFilterMode: AuthFilesStatusFilterMode;
  compactMode: boolean;
  search: string;
  page: number;
  pageSizeByMode: { regular: number; compact: number };
  sortMode: AuthFilesSortMode;
};

const readInitialState = (): AuthFilesPageInitialState => {
  const persisted = readAuthFilesUiState();
  return {
    filter:
      typeof persisted?.filter === 'string' && persisted.filter.trim()
        ? normalizeProviderKey(persisted.filter)
        : 'all',
    statusFilterMode: isAuthFilesStatusFilterMode(persisted?.statusFilterMode)
      ? persisted.statusFilterMode
      : 'all',
    compactMode: persisted?.compactMode === true,
    search: typeof persisted?.search === 'string' ? persisted.search : '',
    page:
      typeof persisted?.page === 'number' && Number.isFinite(persisted.page)
        ? Math.max(1, Math.round(persisted.page))
        : 1,
    pageSizeByMode: {
      regular:
        typeof persisted?.regularPageSize === 'number' &&
        Number.isFinite(persisted.regularPageSize)
          ? clampCardPageSize(persisted.regularPageSize)
          : DEFAULT_REGULAR_PAGE_SIZE,
      compact:
        typeof persisted?.compactPageSize === 'number' &&
        Number.isFinite(persisted.compactPageSize)
          ? clampCardPageSize(persisted.compactPageSize)
          : DEFAULT_COMPACT_PAGE_SIZE,
    },
    sortMode: isAuthFilesSortMode(persisted?.sortMode) ? persisted.sortMode : 'default',
  };
};

export function AuthFilesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme: ResolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const transitionLayer = usePageTransitionLayer();
  const isCurrentLayer = transitionLayer ? transitionLayer.status === 'current' : true;

  const [initialState] = useState(readInitialState);
  const [filter, setFilter] = useState(initialState.filter);
  const [statusFilterMode, setStatusFilterMode] = useState(initialState.statusFilterMode);
  const [compactMode, setCompactMode] = useState(initialState.compactMode);
  const [search, setSearch] = useState(initialState.search);
  const [page, setPage] = useState(initialState.page);
  const [pageSizeByMode, setPageSizeByMode] = useState(initialState.pageSizeByMode);
  const [pageSizeInput, setPageSizeInput] = useState(() =>
    String(
      initialState.compactMode
        ? initialState.pageSizeByMode.compact
        : initialState.pageSizeByMode.regular
    )
  );
  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('list');
  const [sortMode, setSortMode] = useState(initialState.sortMode);
  const initialLoadDoneRef = useRef(false);

  const {
    modelsModalOpen,
    modelsLoading,
    modelsList,
    modelsFileName,
    modelsFileType,
    modelsError,
    showModels,
    closeModelsModal,
    invalidateModels,
  } = useAuthFilesModels();
  const handleFilesMutated = useCallback(
    (names?: string[]) => invalidateAuthFileDerivedCaches(invalidateModels, names),
    [invalidateModels]
  );

  const {
    files,
    selectedFiles,
    selectionCount,
    loading,
    refreshing,
    error,
    uploading,
    deleting,
    deletingAll,
    statusUpdating,
    manualRefreshing,
    batchStatusUpdating,
    fileInputRef,
    loadFiles,
    handleUploadClick,
    handleFileChange,
    handleDelete,
    handleDeleteAll,
    handleDownload,
    handleManualRefresh,
    handleStatusToggle,
    toggleSelect,
    selectAllVisible,
    invertVisibleSelection,
    deselectAll,
    batchDownload,
    batchSetStatus,
    batchDelete,
  } = useAuthFilesData({ onFilesMutated: handleFilesMutated });

  const statusBarCache = useAuthFilesStatusBarCache(files);
  const {
    excluded,
    excludedError,
    modelAlias,
    modelAliasError,
    allProviderModels,
    loadExcluded,
    loadModelAlias,
    deleteExcluded,
    deleteModelAlias,
    handleMappingUpdate,
    handleDeleteLink,
    handleToggleFork,
    handleRenameAlias,
    handleDeleteAlias,
  } = useAuthFilesOauth({ viewMode, files });

  const {
    prefixProxyEditor,
    prefixProxyUpdatedText,
    prefixProxyDirty,
    openPrefixProxyEditor,
    closePrefixProxyEditor,
    handlePrefixProxyChange,
    handlePrefixProxySave,
  } = useAuthFilesPrefixProxyEditor({
    disableControls: connectionStatus !== 'connected',
    loadFiles,
    onFilesMutated: handleFilesMutated,
  });

  const disableControls = connectionStatus !== 'connected';
  const normalizedFilter = normalizeProviderKey(filter);
  const quotaFilterType: QuotaProviderType | null = QUOTA_PROVIDER_TYPES.has(
    normalizedFilter as QuotaProviderType
  )
    ? (normalizedFilter as QuotaProviderType)
    : null;
  const pageSize = compactMode ? pageSizeByMode.compact : pageSizeByMode.regular;
  const problemOnly = statusFilterMode === 'problem';
  const disabledOnly = statusFilterMode === 'disabled';
  const enabledOnly = statusFilterMode === 'enabled';

  useEffect(() => {
    writeAuthFilesUiState({
      filter,
      statusFilterMode,
      compactMode,
      search,
      page,
      regularPageSize: pageSizeByMode.regular,
      compactPageSize: pageSizeByMode.compact,
      sortMode,
    });
  }, [compactMode, filter, page, pageSizeByMode, search, sortMode, statusFilterMode]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  const setCurrentModePageSize = useCallback(
    (next: number) => {
      setPageSizeByMode((current) =>
        compactMode ? { ...current, compact: next } : { ...current, regular: next }
      );
    },
    [compactMode]
  );

  const commitPageSizeInput = useCallback(
    (rawValue: string) => {
      const value = Number(rawValue.trim());
      if (!Number.isFinite(value)) {
        setPageSizeInput(String(pageSize));
        return;
      }
      const next = clampCardPageSize(value);
      setCurrentModePageSize(next);
      setPageSizeInput(String(next));
      setPage(1);
    },
    [pageSize, setCurrentModePageSize]
  );

  const handlePageSizeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.currentTarget.value;
      setPageSizeInput(rawValue);
      const parsed = Number(rawValue.trim());
      if (!Number.isFinite(parsed)) return;
      const rounded = Math.round(parsed);
      if (clampCardPageSize(rounded) !== rounded) return;
      setCurrentModePageSize(rounded);
      setPage(1);
    },
    [setCurrentModePageSize]
  );

  const handleHeaderRefresh = useCallback(async () => {
    await Promise.all([loadFiles({ background: true }), loadExcluded(), loadModelAlias()]);
  }, [loadExcluded, loadFiles, loadModelAlias]);
  useHeaderRefresh(handleHeaderRefresh);

  useEffect(() => {
    if (!isCurrentLayer) return;
    void loadFiles(initialLoadDoneRef.current ? { background: true } : undefined);
    initialLoadDoneRef.current = true;
    void loadExcluded();
    void loadModelAlias();
  }, [isCurrentLayer, loadExcluded, loadFiles, loadModelAlias]);

  useInterval(
    () => void loadFiles({ background: true }).catch(() => undefined),
    isCurrentLayer ? 240_000 : null
  );

  const existingTypes = useMemo(() => {
    const types = new Set<string>(['all']);
    files.forEach((file) => {
      const type = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
      if (type) types.add(type);
    });
    return Array.from(types);
  }, [files]);

  const filesMatchingStatus = useMemo(
    () =>
      files.filter((file) => {
        if (enabledOnly && file.disabled === true) return false;
        if (disabledOnly && file.disabled !== true) return false;
        if (problemOnly && !isProblemAuthFile(file)) return false;
        return true;
      }),
    [disabledOnly, enabledOnly, files, problemOnly]
  );

  const statusFilterOptions = useMemo(
    () =>
      [
        { value: 'all', label: t('auth_files.problem_filter_all') },
        { value: 'enabled', label: t('auth_files.problem_filter_enabled') },
        { value: 'disabled', label: t('auth_files.problem_filter_disabled') },
        { value: 'problem', label: t('auth_files.problem_filter_problem') },
      ] satisfies Array<{ value: AuthFilesStatusFilterMode; label: string }>,
    [t]
  );
  const sortOptions = useMemo(
    () => [
      { value: 'default', label: t('auth_files.sort_default') },
      { value: 'az', label: t('auth_files.sort_az') },
      { value: 'priority', label: t('auth_files.sort_priority') },
    ],
    [t]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filesMatchingStatus.length };
    filesMatchingStatus.forEach((file) => {
      const type = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
      if (type) counts[type] = (counts[type] ?? 0) + 1;
    });
    return counts;
  }, [filesMatchingStatus]);

  const normalizedSearch = search.trim();
  const wildcardSearch = useMemo(() => buildWildcardSearch(normalizedSearch), [normalizedSearch]);
  const filtered = useMemo(() => {
    const normalizedTerm = normalizedSearch.toLowerCase();
    return filesMatchingStatus.filter((file) => {
      const type = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
      if (normalizedFilter !== 'all' && type !== normalizedFilter) return false;
      if (!normalizedSearch) return true;
      return [file.name, file.type, file.provider].some((value) => {
        const content = String(value ?? '');
        return wildcardSearch
          ? wildcardSearch.test(content)
          : content.toLowerCase().includes(normalizedTerm);
      });
    });
  }, [filesMatchingStatus, normalizedFilter, normalizedSearch, wildcardSearch]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortMode === 'az') return copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === 'priority') {
      return copy.sort(
        (a, b) =>
          (parsePriorityValue(b.priority) ?? 0) - (parsePriorityValue(a.priority) ?? 0)
      );
    }
    return copy.sort((a, b) => {
      const providerA = normalizeProviderKey(String(a.provider ?? a.type ?? 'unknown'));
      const providerB = normalizeProviderKey(String(b.provider ?? b.type ?? 'unknown'));
      return providerA.localeCompare(providerB) || a.name.localeCompare(b.name);
    });
  }, [filtered, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = useMemo(() => sorted.slice(start, start + pageSize), [pageSize, sorted, start]);
  const selectablePageItems = useMemo(
    () => pageItems.filter((file) => !isRuntimeOnlyAuthFile(file)),
    [pageItems]
  );
  const selectableFilteredItems = useMemo(
    () => sorted.filter((file) => !isRuntimeOnlyAuthFile(file)),
    [sorted]
  );
  const selectedNames = useMemo(() => Array.from(selectedFiles), [selectedFiles]);
  const selectedHasStatusUpdating = useMemo(
    () => selectedNames.some((name) => statusUpdating[name] === true),
    [selectedNames, statusUpdating]
  );
  const batchStatusButtonsDisabled =
    disableControls ||
    selectedNames.length === 0 ||
    batchStatusUpdating ||
    selectedHasStatusUpdating;

  const activeCount = useMemo(
    () => files.filter((file) => file.disabled !== true).length,
    [files]
  );
  const problemCount = useMemo(() => files.filter(isProblemAuthFile).length, [files]);

  const [cardsAnimated, setCardsAnimated] = useState(false);
  const enableCardEntrance =
    !cardsAnimated && isCurrentLayer && !loading && pageItems.length > 0;
  useEffect(() => {
    if (enableCardEntrance) setCardsAnimated(true);
  }, [enableCardEntrance]);
  const cardEntranceDelay = (index: number): number | null => {
    if (!enableCardEntrance) return null;
    if (pageItems.length <= 1) return 0;
    return Math.round((index / (pageItems.length - 1)) * CARD_ENTRANCE_BUDGET_MS);
  };

  const copyTextWithNotification = useCallback(
    async (text: string) => {
      const copied = await copyToClipboard(text);
      showNotification(
        copied ? t('notification.link_copied') : t('notification.copy_failed'),
        copied ? 'success' : 'error'
      );
    },
    [showNotification, t]
  );

  const openExcludedEditor = useCallback(
    (provider?: string) => {
      const providerValue = (provider || (filter !== 'all' ? filter : '')).trim();
      const params = new URLSearchParams();
      if (providerValue) params.set('provider', providerValue);
      const query = params.toString();
      navigate(`/auth-files/oauth-excluded${query ? `?${query}` : ''}`, {
        state: { fromAuthFiles: true },
      });
    },
    [filter, navigate]
  );

  const openModelAliasEditor = useCallback(
    (provider?: string) => {
      const providerValue = (provider || (filter !== 'all' ? filter : '')).trim();
      const params = new URLSearchParams();
      if (providerValue) params.set('provider', providerValue);
      const query = params.toString();
      navigate(`/auth-files/oauth-model-alias${query ? `?${query}` : ''}`, {
        state: { fromAuthFiles: true },
      });
    },
    [filter, navigate]
  );

  const clearFilters = useCallback(() => {
    setFilter('all');
    setStatusFilterMode('all');
    setSearch('');
    setPage(1);
  }, []);

  const deleteLabel = (() => {
    if (enabledOnly || disabledOnly) return t('auth_files.delete_filtered_result_button');
    if (problemOnly) {
      return normalizedFilter === 'all'
        ? t('auth_files.delete_problem_button')
        : t('auth_files.delete_problem_button_with_type', {
            type: getTypeLabel(t, normalizedFilter),
          });
    }
    return normalizedFilter === 'all'
      ? t('auth_files.delete_all_button')
      : `${t('common.delete')} ${getTypeLabel(t, normalizedFilter)}`;
  })();

  const oauthSectionRef = useRevealOnScroll<HTMLDivElement>();
  const isFirstRunEmpty = !loading && files.length === 0 && !error;
  const isNoResults = !loading && files.length > 0 && pageItems.length === 0;
  const gridClassName = [
    styles.grid,
    compactMode ? styles.gridCompact : '',
    quotaFilterType ? styles.gridQuota : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.page}>
      <VaultHeader
        totalCount={files.length}
        activeCount={activeCount}
        problemCount={problemCount}
        loading={loading}
        refreshing={refreshing}
        uploading={uploading}
        disableControls={disableControls}
        onUpload={handleUploadClick}
        onRefresh={() => void handleHeaderRefresh()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={handleFileChange}
      />

      <section className={styles.workbench} aria-label={t('auth_files.title_section')}>
        <ProviderTabs
          types={existingTypes}
          counts={typeCounts}
          active={normalizedFilter}
          resolvedTheme={resolvedTheme}
          onChange={(type) => {
            setFilter(type);
            setPage(1);
          }}
        />

        <AuthFilesToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          statusFilterMode={statusFilterMode}
          statusFilterOptions={statusFilterOptions}
          onStatusFilterChange={(mode) => {
            setStatusFilterMode(mode);
            setPage(1);
          }}
          sortMode={sortMode}
          sortOptions={sortOptions}
          onSortModeChange={(value) => {
            if (!isAuthFilesSortMode(value)) return;
            setSortMode(value);
            setPage(1);
          }}
          pageSizeInput={pageSizeInput}
          onPageSizeInputChange={handlePageSizeChange}
          onPageSizeCommit={commitPageSizeInput}
          compactMode={compactMode}
          onCompactModeChange={setCompactMode}
          deleteLabel={deleteLabel}
          deleteDisabled={disableControls || loading || deletingAll || files.length === 0}
          deleteLoading={deletingAll}
          onDelete={() =>
            handleDeleteAll({
              filter,
              statusFilterMode,
              onResetFilterToAll: () => setFilter('all'),
              onResetStatusFilter: () => setStatusFilterMode('all'),
            })
          }
        />

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className={gridClassName} aria-hidden="true">
            {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
              <Skeleton key={index} height={188} rounded={8} />
            ))}
          </div>
        ) : isFirstRunEmpty ? (
          <EmptyState
            title={t('auth_files.empty_title')}
            description={t('auth_files.empty_desc')}
            action={
              <div className={styles.emptyActions}>
                <Button size="sm" onClick={handleUploadClick} disabled={disableControls || uploading}>
                  {t('auth_files.upload_button')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/oauth')}>
                  {t('auth_files.empty_oauth_link')}
                </Button>
              </div>
            }
          />
        ) : isNoResults ? (
          <EmptyState
            title={t('auth_files.search_empty_title')}
            description={t('auth_files.search_empty_desc')}
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {t('auth_files.no_results_clear')}
              </Button>
            }
          />
        ) : (
          <div className={gridClassName}>
            {pageItems.map((file, index) => (
              <AuthFileCard
                key={file.name}
                file={file}
                compact={compactMode}
                selected={selectedFiles.has(file.name)}
                resolvedTheme={resolvedTheme}
                disableControls={disableControls}
                deleting={deleting}
                statusUpdating={statusUpdating}
                manualRefreshing={manualRefreshing}
                quotaFilterType={quotaFilterType}
                statusBarCache={statusBarCache}
                entranceDelayMs={cardEntranceDelay(index)}
                onShowModels={showModels}
                onDownload={handleDownload}
                onManualRefresh={handleManualRefresh}
                onOpenPrefixProxyEditor={openPrefixProxyEditor}
                onDelete={handleDelete}
                onToggleStatus={handleStatusToggle}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}

        {!loading && sorted.length > pageSize && (
          <div className={styles.pagination}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              {t('auth_files.pagination_prev')}
            </Button>
            <div className={styles.pageInfo}>
              {t('auth_files.pagination_info', {
                current: currentPage,
                total: totalPages,
                count: sorted.length,
              })}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              {t('auth_files.pagination_next')}
            </Button>
          </div>
        )}
      </section>

      <div className={styles.configGrid} ref={oauthSectionRef}>
        <OAuthExcludedCard
          disableControls={disableControls}
          excludedError={excludedError}
          excluded={excluded}
          onRetry={loadExcluded}
          onAdd={() => openExcludedEditor()}
          onEdit={openExcludedEditor}
          onDelete={deleteExcluded}
        />
        <OAuthModelAliasCard
          disableControls={disableControls}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRetry={loadModelAlias}
          onAdd={() => openModelAliasEditor()}
          onEditProvider={openModelAliasEditor}
          onDeleteProvider={deleteModelAlias}
          modelAliasError={modelAliasError}
          modelAlias={modelAlias}
          allProviderModels={allProviderModels}
          onUpdate={handleMappingUpdate}
          onDeleteLink={handleDeleteLink}
          onToggleFork={handleToggleFork}
          onRenameAlias={handleRenameAlias}
          onDeleteAlias={handleDeleteAlias}
        />
      </div>

      <AuthFileModelsModal
        open={modelsModalOpen}
        fileName={modelsFileName}
        fileType={modelsFileType}
        loading={modelsLoading}
        error={modelsError}
        models={modelsList}
        excluded={excluded}
        onClose={closeModelsModal}
        onCopyText={copyTextWithNotification}
      />
      <AuthFileDetailsSheet
        disableControls={disableControls}
        editor={prefixProxyEditor}
        updatedText={prefixProxyUpdatedText}
        dirty={prefixProxyDirty}
        onClose={closePrefixProxyEditor}
        onCopyText={copyTextWithNotification}
        onSave={handlePrefixProxySave}
        onChange={handlePrefixProxyChange}
      />
      <BatchActionBar
        selectionCount={selectionCount}
        selectablePageCount={selectablePageItems.length}
        selectableFilteredCount={selectableFilteredItems.length}
        disableControls={disableControls}
        batchStatusDisabled={batchStatusButtonsDisabled}
        onSelectPage={() => selectAllVisible(pageItems)}
        onSelectFiltered={() => selectAllVisible(sorted)}
        onInvertPage={() => invertVisibleSelection(pageItems)}
        onDeselectAll={deselectAll}
        onDownload={() => void batchDownload(selectedNames)}
        onEnable={() => batchSetStatus(selectedNames, true)}
        onDisable={() => batchSetStatus(selectedNames, false)}
        onDelete={() => batchDelete(selectedNames)}
      />
    </div>
  );
}
