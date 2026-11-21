import { AUTH_FILES_CHANGED_EVENT } from './authFilesEvents';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { usePageTransitionLayer } from '@/components/common/PageTransitionLayer';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StackedColumns } from '@/components/ui/StackedColumns';
import { readCardLayout, writeCardLayout, type CardLayout } from '@/components/ui/cardLayout';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useInterval } from '@/hooks/useInterval';
import { useRevealOnScroll } from '@/hooks/motion';
import { useAuthStore, useNotificationStore, useQuotaStore, useThemeStore } from '@/stores';
import type { ResolvedTheme } from '@/types';
import { copyToClipboard } from '@/utils/clipboard';
import { invalidateAuthFileDerivedCaches } from '@/features/authFiles/cacheInvalidation';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import {
  QUOTA_PROVIDER_TYPES,
  clampCardPageSize,
  getTypeLabel,
  isProblemAuthFile,
  isRuntimeOnlyAuthFile,
  normalizeProviderKey,
  type AuthFileQuotaFilter,
  type QuotaProviderType,
} from '@/features/authFiles/constants';
import { AuthFileCard } from '@/features/authFiles/components/AuthFileCard';
import { AuthFileDetailsSheet } from '@/features/authFiles/components/AuthFileDetailsSheet';
import { getAuthFileRefreshKey } from '@/features/authFiles/manualRefresh';
import { AuthFileRefreshResults } from '@/features/authFiles/components/AuthFileRefreshResults';
import { AuthFileModelsModal } from '@/features/authFiles/components/AuthFileModelsModal';
import { AuthFilesToolbar } from '@/features/authFiles/components/AuthFilesToolbar';
import { BatchActionBar } from '@/features/authFiles/components/BatchActionBar';
import { ModelRulesEntry } from '@/features/authFiles/components/ModelRulesEntry';
import { ProviderTabs } from '@/features/authFiles/components/ProviderTabs';
import { VaultHeader } from '@/features/authFiles/components/VaultHeader';
import {
  buildWildcardSearch,
  matchesAuthFileSearch,
  sortAuthFiles,
} from '@/features/authFiles/logic';
import { useAuthFilesData } from '@/features/authFiles/hooks/useAuthFilesData';
import { useAuthFilesModels } from '@/features/authFiles/hooks/useAuthFilesModels';
import { useAuthFilesOauth } from '@/features/authFiles/hooks/useAuthFilesOauth';
import { useModelCatalogSync } from '@/features/authFiles/hooks/useModelCatalogSync';
import { buildModelRulesPath } from '@/features/authFiles/modelRules/useModelRulesRoute';
import type { ModelRulesKind } from '@/features/authFiles/modelRules/useModelRulesData';
import { useAuthFilesPrefixProxyEditor } from '@/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import { useAuthFilesStatusBarCache } from '@/features/authFiles/hooks/useAuthFilesStatusBarCache';
import { QUOTA_ADAPTERS } from '@/features/quota/providers';
import type { QuotaStore } from '@/features/quota/providers/types';
import {
  AUTH_FILES_CARD_LAYOUT_KEY,
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

type AuthFilesPageInitialState = {
  filter: string;
  statusFilterMode: AuthFilesStatusFilterMode;
  layout: CardLayout;
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
    // 卡片布局出现前，紧凑开关是唯一选择。
    layout: readCardLayout(
      AUTH_FILES_CARD_LAYOUT_KEY,
      persisted?.compactMode === true ? 'compact' : 'even'
    ),
    search: typeof persisted?.search === 'string' ? persisted.search : '',
    page:
      typeof persisted?.page === 'number' && Number.isFinite(persisted.page)
        ? Math.max(1, Math.round(persisted.page))
        : 1,
    pageSizeByMode: {
      regular:
        typeof persisted?.regularPageSize === 'number' && Number.isFinite(persisted.regularPageSize)
          ? clampCardPageSize(persisted.regularPageSize)
          : DEFAULT_REGULAR_PAGE_SIZE,
      compact:
        typeof persisted?.compactPageSize === 'number' && Number.isFinite(persisted.compactPageSize)
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
  const [layout, setLayout] = useState<CardLayout>(initialState.layout);
  // 紧凑是页面原有的紧凑卡片，保留自己的每页数量。
  const compactMode = layout === 'compact';
  const [search, setSearch] = useState(initialState.search);
  const [page, setPage] = useState(initialState.page);
  const [pageSizeByMode, setPageSizeByMode] = useState(initialState.pageSizeByMode);
  const [pageSizeInput, setPageSizeInput] = useState(() =>
    String(
      initialState.layout === 'compact'
        ? initialState.pageSizeByMode.compact
        : initialState.pageSizeByMode.regular
    )
  );
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
  const { syncingModelCatalog, syncModelCatalog } = useModelCatalogSync(() => {
    invalidateModels();
    if (modelsModalOpen) {
      void showModels({ name: modelsFileName, type: modelsFileType });
    }
  });
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
    refreshingAllCredentials,
    refreshResults,
    closeRefreshResults,
    handleRefreshAllCredentials,
    cooldownResetting,
    batchStatusUpdating,
    fileInputRef,
    loadFiles,
    handleUploadClick,
    handleFileChange,
    handleDelete,
    handleDeleteAll,
    handleDownload,
    handleManualRefresh,
    handleCooldownReset,
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
  const { excluded, excludedError, modelAlias, modelAliasError, loadExcluded, loadModelAlias } =
    useAuthFilesOauth();

  const {
    prefixProxyEditor,
    prefixProxyUpdatedText,
    prefixProxyDirty,
    openPrefixProxyEditor,
    closePrefixProxyEditor,
    handlePrefixProxyChange,
    handlePrefixProxySave,
  } = useAuthFilesPrefixProxyEditor({
    disableControls: connectionStatus !== 'connected' || refreshingAllCredentials,
    loadFiles,
    onFilesMutated: handleFilesMutated,
  });

  const disableControls = connectionStatus !== 'connected' || refreshingAllCredentials;
  const normalizedFilter = normalizeProviderKey(filter);
  const quotaFilterType: QuotaProviderType | null = QUOTA_PROVIDER_TYPES.has(
    normalizedFilter as QuotaProviderType
  )
    ? (normalizedFilter as QuotaProviderType)
    : null;
  const activeQuotaFilter: AuthFileQuotaFilter =
    normalizedFilter === 'all' ? 'all' : (quotaFilterType ?? normalizedFilter) || null;
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
    writeCardLayout(AUTH_FILES_CARD_LAYOUT_KEY, layout);
  }, [compactMode, layout, filter, page, pageSizeByMode, search, sortMode, statusFilterMode]);

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

  useEffect(() => {
    const refresh = () => {
      if (isCurrentLayer) void loadFiles({ background: true });
    };
    window.addEventListener(AUTH_FILES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_FILES_CHANGED_EVENT, refresh);
  }, [isCurrentLayer, loadFiles]);

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
    return filesMatchingStatus.filter((file) => {
      const type = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
      if (normalizedFilter !== 'all' && type !== normalizedFilter) return false;
      return matchesAuthFileSearch(file, normalizedSearch, wildcardSearch);
    });
  }, [filesMatchingStatus, normalizedFilter, normalizedSearch, wildcardSearch]);

  const sorted = useMemo(() => sortAuthFiles(filtered, sortMode), [filtered, sortMode]);

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
    () =>
      files.some(
        (file) =>
          selectedFiles.has(file.name) && statusUpdating[getAuthFileRefreshKey(file)] === true
      ),
    [files, selectedFiles, statusUpdating]
  );
  const batchStatusButtonsDisabled =
    disableControls ||
    selectedNames.length === 0 ||
    batchStatusUpdating ||
    selectedHasStatusUpdating;

  const activeCount = useMemo(() => files.filter((file) => file.disabled !== true).length, [files]);
  const problemCount = useMemo(() => files.filter(isProblemAuthFile).length, [files]);

  const [cardsAnimated, setCardsAnimated] = useState(false);
  const enableCardEntrance = !cardsAnimated && isCurrentLayer && !loading && pageItems.length > 0;
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

  const openModelRules = useCallback(
    (kind: ModelRulesKind, provider?: string) => {
      const providerValue = (provider || (filter !== 'all' ? filter : '')).trim();
      navigate(buildModelRulesPath(kind, providerValue), { state: { fromAuthFiles: true } });
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
  // 额度仍在加载的凭证，拼成一个字符串比较，堆叠布局据此避免加载中的卡片被压缩。
  const loadingQuotaKeys = useQuotaStore((state) =>
    Object.values(QUOTA_ADAPTERS)
      .flatMap((adapter) =>
        Object.entries(adapter.storeSelector(state as unknown as QuotaStore))
          .filter(([, quota]) => quota?.status === 'loading')
          .map(([key]) => key)
      )
      .join('\n')
  );
  const loadingQuotaSet = useMemo(() => new Set(loadingQuotaKeys.split('\n')), [loadingQuotaKeys]);

  const isFirstRunEmpty = !loading && files.length === 0 && !error;
  const isNoResults = !loading && files.length > 0 && pageItems.length === 0;
  const gridClassName = [
    styles.grid,
    compactMode ? styles.gridCompact : '',
    activeQuotaFilter ? styles.gridQuota : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.page}>
      <VaultHeader
        syncingModelCatalog={syncingModelCatalog}
        onSyncModelCatalog={() => void syncModelCatalog()}
        modelCatalogSyncDisabled={connectionStatus !== 'connected'}
        totalCount={files.length}
        activeCount={activeCount}
        problemCount={problemCount}
        loading={loading}
        refreshing={refreshing}
        uploading={uploading}
        disableControls={disableControls}
        onUpload={handleUploadClick}
        onRefresh={() => void handleHeaderRefresh()}
        refreshingCredentials={refreshingAllCredentials}
        credentialRefreshDisabled={Object.keys(manualRefreshing).length > 0}
        onRefreshCredentials={handleRefreshAllCredentials}
      />
      <AuthFileRefreshResults results={refreshResults} onClose={closeRefreshResults} />
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
          layout={layout}
          onLayoutChange={setLayout}
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
                <Button
                  size="sm"
                  onClick={handleUploadClick}
                  disabled={disableControls || uploading}
                >
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
          // 所有布局共用一个容器，切换布局不会重挂载卡片。
          <StackedColumns
            stacked={layout !== 'even'}
            className={layout === 'even' ? gridClassName : undefined}
            minColumnWidth={compactMode && !activeQuotaFilter ? 260 : 340}
            gap={16}
            items={pageItems.map((file, index) => ({
              key: getQuotaCacheKey(file),
              node: (
                <AuthFileCard
                  file={file}
                  compact={compactMode}
                  selected={selectedFiles.has(file.name)}
                  resolvedTheme={resolvedTheme}
                  disableControls={disableControls}
                  deleting={deleting}
                  statusUpdating={statusUpdating}
                  manualRefreshing={manualRefreshing}
                  cooldownResetting={cooldownResetting}
                  quotaFilterType={activeQuotaFilter}
                  statusBarCache={statusBarCache}
                  entranceDelayMs={cardEntranceDelay(index)}
                  onShowModels={showModels}
                  onDownload={handleDownload}
                  onManualRefresh={handleManualRefresh}
                  onCooldownReset={handleCooldownReset}
                  onOpenPrefixProxyEditor={openPrefixProxyEditor}
                  onDelete={handleDelete}
                  onToggleStatus={handleStatusToggle}
                  onToggleSelect={toggleSelect}
                />
              ),
              settled: !loadingQuotaSet.has(getQuotaCacheKey(file)),
            }))}
          />
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

      <div ref={oauthSectionRef}>
        <ModelRulesEntry
          excluded={excluded}
          excludedError={excludedError}
          modelAlias={modelAlias}
          modelAliasError={modelAliasError}
          scope={normalizedFilter}
          resolvedTheme={resolvedTheme}
          onOpenExcluded={(provider) => openModelRules('excluded', provider)}
          onOpenAlias={(provider) => openModelRules('alias', provider)}
          onRetryExcluded={loadExcluded}
          onRetryAlias={loadModelAlias}
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
