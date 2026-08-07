import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import type { HeaderMetaSegment } from '../uiState';
import styles from './ConfigHeader.module.scss';

export type ConfigHeaderProps = {
  /** ▍mono meta 行的段落序列（uiState.buildHeaderMeta 的产物）。 */
  meta: HeaderMetaSegment[];
  reloadDisabled: boolean;
  reloading: boolean;
  onReload: () => void;
};

/**
 * 配置面板头部：沿用工作台页面的遥测 meta 行与操作区。
 * 页面标题由 MainLayout 统一承载，避免内容区重复显示。
 * 保存动作不在头部常驻 —— 由 FloatingSaveBar 在 dirty 时承载。
 */
export function ConfigHeader({
  meta,
  reloadDisabled,
  reloading,
  onReload,
}: ConfigHeaderProps) {
  const { t } = useTranslation();
  const toneClass: Record<HeaderMetaSegment['tone'], string> = {
    muted: styles.metaMuted,
    warning: styles.metaWarning,
    error: styles.metaError,
    ok: styles.metaOk,
  };

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <p className={styles.meta} data-reveal>
          {meta.map((segment, index) => (
            <Fragment key={segment.key}>
              {index > 0 ? (
                <span className={styles.metaDot} aria-hidden="true">
                  ·
                </span>
              ) : null}
              <span className={toneClass[segment.tone]}>
                {segment.count !== undefined
                  ? t(segment.labelKey, { count: segment.count })
                  : t(segment.labelKey)}
              </span>
            </Fragment>
          ))}
        </p>
      </div>
      <div className={styles.actions} data-reveal>
        <Button
          variant="secondary"
          size="sm"
          onClick={onReload}
          disabled={reloadDisabled}
          loading={reloading}
        >
          {!reloading && <IconRefreshCw size={14} />}
          {t('config_management.reload')}
        </Button>
      </div>
    </header>
  );
}
