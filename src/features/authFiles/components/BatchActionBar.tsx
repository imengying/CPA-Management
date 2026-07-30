import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { animate } from 'motion/mini';
import { Button } from '@/components/ui/Button';
import { useActionBarHeightVar } from '@/hooks/useActionBarHeightVar';
import { prefersReducedMotion } from '@/hooks/motion';
import styles from './BatchActionBar.module.scss';

const easeOut = (progress: number) => 1 - (1 - progress) ** 4;
const easeIn = (progress: number) => progress ** 3;
const BASE_TRANSFORM = 'translateX(-50%)';
const HIDDEN_TRANSFORM = 'translateX(-50%) translateY(56px)';

export type BatchActionBarProps = {
  selectionCount: number;
  selectablePageCount: number;
  selectableFilteredCount: number;
  disableControls: boolean;
  batchStatusDisabled: boolean;
  onSelectPage: () => void;
  onSelectFiltered: () => void;
  onInvertPage: () => void;
  onDeselectAll: () => void;
  onDownload: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onDelete: () => void;
};

export function BatchActionBar(props: BatchActionBarProps) {
  const {
    selectionCount,
    selectablePageCount,
    selectableFilteredCount,
    disableControls,
    batchStatusDisabled,
    onSelectPage,
    onSelectFiltered,
    onInvertPage,
    onDeselectAll,
    onDownload,
    onEnable,
    onDisable,
    onDelete,
  } = props;
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const selectionCountRef = useRef(selectionCount);
  const previousCountRef = useRef(0);

  useActionBarHeightVar(containerRef, '--auth-files-action-bar-height', visible);

  useEffect(() => {
    selectionCountRef.current = selectionCount;
    if (selectionCount > 0) setVisible(true);
  }, [selectionCount]);

  useLayoutEffect(() => {
    if (!visible) return;
    const element = containerRef.current;
    if (!element) return;

    const currentCount = selectionCount;
    const previousCount = previousCountRef.current;
    const reducedMotion = prefersReducedMotion();
    animationRef.current?.stop();

    if (currentCount > 0 && previousCount === 0) {
      element.style.transform = reducedMotion ? BASE_TRANSFORM : HIDDEN_TRANSFORM;
      animationRef.current = animate(
        element,
        reducedMotion
          ? { opacity: [0, 1] }
          : { transform: [HIDDEN_TRANSFORM, BASE_TRANSFORM], opacity: [0, 1] },
        {
          duration: reducedMotion ? 0.15 : 0.28,
          ease: reducedMotion ? 'linear' : easeOut,
          onComplete: () => {
            element.style.transform = BASE_TRANSFORM;
            element.style.opacity = '1';
          },
        }
      );
    } else if (currentCount === 0 && previousCount > 0) {
      animationRef.current = animate(
        element,
        reducedMotion
          ? { opacity: [1, 0] }
          : { transform: [BASE_TRANSFORM, HIDDEN_TRANSFORM], opacity: [1, 0] },
        {
          duration: reducedMotion ? 0.12 : 0.22,
          ease: reducedMotion ? 'linear' : easeIn,
          onComplete: () => {
            if (selectionCountRef.current === 0) setVisible(false);
          },
        }
      );
    }

    previousCountRef.current = currentCount;
  }, [selectionCount, visible]);

  useEffect(
    () => () => {
      animationRef.current?.stop();
    },
    []
  );

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.container} ref={containerRef}>
      <div className={styles.bar} role="toolbar" aria-label={t('auth_files.batch_toolbar_label')}>
        <div className={styles.left}>
          <span className={styles.count} aria-live="polite">
            {t('auth_files.batch_selected', { count: selectionCount })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onSelectPage}
            disabled={selectablePageCount === 0}
          >
            {t('auth_files.batch_select_page')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onSelectFiltered}
            disabled={selectableFilteredCount === 0}
          >
            {t('auth_files.batch_select_filtered')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onInvertPage}
            disabled={selectablePageCount === 0}
          >
            {t('auth_files.batch_invert_page')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeselectAll}>
            {t('auth_files.batch_deselect')}
          </Button>
        </div>
        <div className={styles.right}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownload}
            disabled={disableControls || selectionCount === 0}
          >
            {t('auth_files.batch_download')}
          </Button>
          <Button size="sm" onClick={onEnable} disabled={batchStatusDisabled}>
            {t('auth_files.batch_enable')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onDisable} disabled={batchStatusDisabled}>
            {t('auth_files.batch_disable')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            disabled={disableControls || selectionCount === 0}
          >
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
