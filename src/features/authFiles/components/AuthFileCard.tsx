import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  IconDownload,
  IconInfo,
  IconModelCluster,
  IconRefreshCw,
  IconSettings,
  IconTrash2,
} from '@/components/ui/icons';
import type { AuthFileItem, ResolvedTheme } from '@/types';
import { formatFileSize } from '@/utils/format';
import { resolveAuthProvider } from '@/utils/quota';
import {
  normalizeRecentRequestAuthIndex,
  normalizeRecentRequestBuckets,
  normalizeUsageTotal,
  statusBarDataFromRecentRequests,
} from '@/utils/recentRequests';
import {
  QUOTA_PROVIDER_TYPES,
  formatModified,
  getAuthFileIcon,
  getAuthFileStatusMessage,
  getThemeSurfaceIconBackground,
  getTypeColor,
  getTypeLabel,
  hasAuthFileStatusWarning,
  isRuntimeOnlyAuthFile,
  isThemeSurfaceIconProvider,
  normalizeProviderKey,
  parsePriorityValue,
  supportsAuthFileManualRefresh,
  type QuotaProviderType,
} from '@/features/authFiles/constants';
import { deriveAuthFileIdentity } from '@/features/authFiles/identity';
import { AuthFileQuotaContent } from '@/features/authFiles/components/AuthFileQuotaContent';
import type { AuthFileStatusBarData } from '@/features/authFiles/hooks/useAuthFilesStatusBarCache';
import { useAuthFileQuotaControls } from '@/features/authFiles/hooks/useAuthFileQuotaControls';
import styles from './AuthFileCard.module.scss';

export type AuthFileCardProps = {
  file: AuthFileItem;
  compact: boolean;
  selected: boolean;
  resolvedTheme: ResolvedTheme;
  disableControls: boolean;
  deleting: string | null;
  statusUpdating: Record<string, boolean>;
  manualRefreshing: Record<string, boolean>;
  quotaFilterType: QuotaProviderType | null;
  statusBarCache: Map<string, AuthFileStatusBarData>;
  entranceDelayMs?: number | null;
  onShowModels: (file: AuthFileItem) => void;
  onDownload: (name: string) => void;
  onManualRefresh: (file: AuthFileItem) => void;
  onOpenPrefixProxyEditor: (file: AuthFileItem) => void;
  onDelete: (name: string) => void;
  onToggleStatus: (file: AuthFileItem, enabled: boolean) => void;
  onToggleSelect: (name: string) => void;
};

const resolveQuotaType = (file: AuthFileItem): QuotaProviderType | null => {
  const provider = resolveAuthProvider(file);
  return QUOTA_PROVIDER_TYPES.has(provider as QuotaProviderType)
    ? (provider as QuotaProviderType)
    : null;
};

export function AuthFileCard(props: AuthFileCardProps) {
  const {
    file,
    compact,
    selected,
    resolvedTheme,
    disableControls,
    deleting,
    statusUpdating,
    manualRefreshing,
    quotaFilterType,
    statusBarCache,
    entranceDelayMs,
    onShowModels,
    onDownload,
    onManualRefresh,
    onOpenPrefixProxyEditor,
    onDelete,
    onToggleStatus,
    onToggleSelect,
  } = props;
  const { t } = useTranslation();

  const isRuntimeOnly = isRuntimeOnlyAuthFile(file);
  const providerKey = normalizeProviderKey(String(file.type ?? file.provider ?? 'unknown'));
  const showModelsButton = !isRuntimeOnly || providerKey === 'aistudio';
  const showManualRefreshButton = !isRuntimeOnly && supportsAuthFileManualRefresh(providerKey);
  const isManualRefreshing = manualRefreshing[file.name] === true;
  const typeColor = getTypeColor(providerKey, resolvedTheme);
  const typeLabel = getTypeLabel(t, providerKey);
  const providerIcon = getAuthFileIcon(providerKey, resolvedTheme);
  const useThemeSurfaceIcon = isThemeSurfaceIconProvider(providerKey);

  const quotaType =
    quotaFilterType && resolveQuotaType(file) === quotaFilterType ? quotaFilterType : null;
  const showQuotaLayout = Boolean(quotaType) && !isRuntimeOnly && !compact;
  const quotaControls = useAuthFileQuotaControls({ file, quotaType, disableControls });

  const recentBuckets = normalizeRecentRequestBuckets(file.recent_requests ?? file.recentRequests);
  const successCount = file.successCount ?? normalizeUsageTotal(file.success);
  const failureCount = file.failureCount ?? normalizeUsageTotal(file.failed);
  const authIndexKey = normalizeRecentRequestAuthIndex(file['auth_index'] ?? file.authIndex);
  const statusData =
    (authIndexKey && statusBarCache.get(authIndexKey)) ||
    statusBarDataFromRecentRequests(recentBuckets);
  const statusMessage = getAuthFileStatusMessage(file);
  const hasStatusWarning = hasAuthFileStatusWarning(file);
  const priorityValue = parsePriorityValue(file.priority ?? file['priority']);
  const weightValue = parsePriorityValue(file.weight ?? file['weight']);
  const noteValue = typeof file.note === 'string' ? file.note.trim() : '';
  const identity = deriveAuthFileIdentity(file);

  const stateLabel = isRuntimeOnly
    ? t('auth_files.type_virtual')
    : file.disabled
      ? t('auth_files.health_status_disabled')
      : hasStatusWarning
        ? t('auth_files.health_status_warning')
        : statusMessage
          ? t('auth_files.health_status_healthy')
          : t('auth_files.status_toggle_label');
  const stateBadgeClass = isRuntimeOnly
    ? styles.stateVirtual
    : file.disabled
      ? styles.stateDisabled
      : hasStatusWarning
        ? styles.stateWarning
        : styles.stateActive;

  const [mountEntranceDelayMs] = useState<number | null>(entranceDelayMs ?? null);
  const cardClassName = [
    styles.card,
    compact ? styles.cardCompact : '',
    selected ? styles.cardSelected : '',
    file.disabled ? styles.cardDisabled : '',
    mountEntranceDelayMs !== null ? styles.cardEnter : '',
  ]
    .filter(Boolean)
    .join(' ');
  const cardStyle =
    mountEntranceDelayMs === null
      ? undefined
      : ({ '--card-delay': `${mountEntranceDelayMs}ms` } as CSSProperties);

  return (
    <article className={cardClassName} style={cardStyle}>
      <header className={styles.head}>
        {!isRuntimeOnly && (
          <SelectionCheckbox
            checked={selected}
            onChange={() => onToggleSelect(file.name)}
            className={styles.selection}
            aria-label={
              selected ? t('auth_files.batch_deselect') : t('auth_files.batch_select_all')
            }
            title={selected ? t('auth_files.batch_deselect') : t('auth_files.batch_select_all')}
          />
        )}
        <div
          className={styles.avatar}
          style={
            useThemeSurfaceIcon
              ? {
                  backgroundColor: getThemeSurfaceIconBackground(resolvedTheme),
                  color: typeColor.text,
                }
              : {
                  backgroundColor: typeColor.bg,
                  color: typeColor.text,
                  ...(typeColor.border ? { border: typeColor.border } : {}),
                }
          }
        >
          {providerIcon ? (
            <img src={providerIcon} alt="" className={styles.avatarImage} />
          ) : (
            <span className={styles.avatarFallback}>{typeLabel.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className={styles.identity}>
          <div className={styles.badgeRow}>
            <span
              className={styles.typeBadge}
              style={{
                backgroundColor: typeColor.bg,
                color: typeColor.text,
                ...(typeColor.border ? { border: typeColor.border } : {}),
              }}
            >
              {typeLabel}
            </span>
            <span className={`${styles.stateBadge} ${stateBadgeClass}`}>
              <span className={styles.stateDot} aria-hidden="true" />
              {stateLabel}
            </span>
          </div>
          <span
            className={`${styles.account} ${identity.kind === 'fileName' ? styles.accountMono : ''}`}
            title={identity.primary}
          >
            {identity.primary}
          </span>
        </div>
      </header>

      {identity.secondary && (
        <p className={styles.fileName} title={file.name}>
          {identity.secondary}
        </p>
      )}

      {!compact && noteValue && (
        <p className={styles.note} title={noteValue}>
          {noteValue}
        </p>
      )}

      {statusMessage && hasStatusWarning && (
        <div className={styles.warning} title={statusMessage}>
          <IconInfo className={styles.warningIcon} size={14} />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className={styles.health}>
        <div className={styles.healthHead}>
          <span className={styles.healthLabel}>{t('auth_files.health_status_label')}</span>
          <span className={styles.healthCounts}>
            <span className={successCount > 0 ? styles.countOkLive : styles.countMuted}>
              {t('stats.success')} {successCount}
            </span>
            <span className={failureCount > 0 ? styles.countFailLive : styles.countMuted}>
              {t('stats.failure')} {failureCount}
            </span>
          </span>
        </div>
        <ProviderStatusBar statusData={statusData} styles={styles} />
      </div>

      <div className={styles.metaRow}>
        <span title={t('auth_files.file_size')}>{file.size ? formatFileSize(file.size) : '-'}</span>
        <span className={styles.metaDivider} aria-hidden="true">
          &middot;
        </span>
        <span title={t('auth_files.file_modified')}>{formatModified(file)}</span>
        {priorityValue !== undefined && (
          <>
            <span className={styles.metaDivider} aria-hidden="true">
              &middot;
            </span>
            <span className={styles.metaPriority} title={t('auth_files.priority_hint')}>
              <span>{t('auth_files.priority_display')}</span>
              <strong>{priorityValue}</strong>
            </span>
          </>
        )}
        {weightValue !== undefined && (
          <>
            <span className={styles.metaDivider} aria-hidden="true">
              &middot;
            </span>
            <span className={styles.metaWeight} title={t('auth_files.weight_hint')}>
              <span>{t('auth_files.weight_display')}</span>
              <strong>{weightValue}</strong>
            </span>
          </>
        )}
      </div>

      {showQuotaLayout && (
        <AuthFileQuotaContent controls={quotaControls} refreshDisabled={isManualRefreshing} />
      )}

      <footer className={styles.actions}>
        <div className={styles.actionsMain}>
          {showModelsButton && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onShowModels(file)}
              title={t('auth_files.models_button')}
              disabled={disableControls}
            >
              <IconModelCluster size={14} />
              {t('auth_files.models_button')}
            </Button>
          )}
          {!isRuntimeOnly && (
            <div className={styles.utilityActions}>
              {showManualRefreshButton && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onManualRefresh(file)}
                  className={styles.iconButton}
                  title={t('auth_files.manual_refresh_button')}
                  aria-label={t('auth_files.manual_refresh_button')}
                  disabled={
                    disableControls ||
                    file.disabled ||
                    statusUpdating[file.name] === true ||
                    isManualRefreshing ||
                    quotaControls.quotaLoading
                  }
                >
                  {isManualRefreshing ? <LoadingSpinner size={14} /> : <IconRefreshCw size={15} />}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onDownload(file.name)}
                className={styles.iconButton}
                title={t('auth_files.download_button')}
                aria-label={t('auth_files.download_button')}
                disabled={disableControls}
              >
                <IconDownload size={15} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenPrefixProxyEditor(file)}
                className={styles.iconButton}
                title={t('auth_files.prefix_proxy_button')}
                aria-label={t('auth_files.prefix_proxy_button')}
                disabled={disableControls || isManualRefreshing}
              >
                <IconSettings size={15} />
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete(file.name)}
                className={styles.iconButton}
                title={t('auth_files.delete_button')}
                aria-label={t('auth_files.delete_button')}
                disabled={disableControls || deleting === file.name || isManualRefreshing}
              >
                {deleting === file.name ? <LoadingSpinner size={14} /> : <IconTrash2 size={15} />}
              </Button>
            </div>
          )}
        </div>
        {!isRuntimeOnly && (
          <div className={styles.toggleWrap}>
            <span className={styles.toggleLabel}>{t('auth_files.status_toggle_label')}</span>
            <ToggleSwitch
              ariaLabel={t('auth_files.status_toggle_label')}
              checked={!file.disabled}
              disabled={disableControls || statusUpdating[file.name] === true || isManualRefreshing}
              onChange={(enabled) => onToggleStatus(file, enabled)}
            />
          </div>
        )}
      </footer>
    </article>
  );
}
