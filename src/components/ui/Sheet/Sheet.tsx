import { useId, useRef, type ReactNode, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconX } from '../icons';
import { useDialogLifecycle } from '../useDialogLifecycle';
import styles from './Sheet.module.scss';

export type SheetSize = 'md' | 'lg' | 'xl';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  size?: SheetSize;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  closeDisabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /**
   * If provided, called before starting the close animation when the user
   * triggers a close (Escape, overlay click, or close button). Return false
   * (or a Promise that resolves to false) to keep the sheet open.
   */
  confirmClose?: () => boolean | Promise<boolean>;
}

const CLOSE_ANIMATION_DURATION = 280;
const SIZE_CLASS: Record<SheetSize, string> = {
  md: styles.sizeMd,
  lg: styles.sizeLg,
  xl: styles.sizeXl,
};

export function Sheet({
  open,
  onClose,
  size = 'md',
  eyebrow,
  title,
  description,
  footer,
  closeDisabled = false,
  className,
  ariaLabel,
  confirmClose,
  children,
}: PropsWithChildren<SheetProps>) {
  const { t } = useTranslation();
  const titleId = useId();
  const descId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const { isClosing, requestClose, shouldRender } = useDialogLifecycle({
    open,
    onClose,
    closeDisabled,
    closeAnimationDuration: CLOSE_ANIMATION_DURATION,
    dialogRef: sheetRef,
    initialFocusRef: closeBtnRef,
    confirmClose,
  });

  if (!shouldRender) return null;

  const stateClass = isClosing ? styles.exiting : styles.entering;
  const overlayCls = `${styles.overlay} ${stateClass}`.trim();
  const contentCls = [styles.content, SIZE_CLASS[size], stateClass, className]
    .filter(Boolean)
    .join(' ');

  const content = (
    <div
      className={overlayCls}
      role="presentation"
      onMouseDown={(e) => {
        if (closeDisabled) return;
        if (e.target === e.currentTarget) void requestClose();
      }}
    >
      <div
        ref={sheetRef}
        className={contentCls}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-label={!title && ariaLabel ? ariaLabel : undefined}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className={styles.closeBtn}
          onClick={closeDisabled ? undefined : () => void requestClose()}
          disabled={closeDisabled}
          aria-label={t('common.close')}
        >
          <IconX size={18} />
        </button>
        {(eyebrow || title || description) && (
          <div className={styles.header}>
            {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
            {title ? (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
