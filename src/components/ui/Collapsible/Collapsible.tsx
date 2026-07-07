import {
  useState,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { IconChevronDown } from '../icons';
import styles from './Collapsible.module.scss';

interface CollapsibleProps extends Omit<HTMLAttributes<HTMLDetailsElement>, 'onToggle'> {
  label: ReactNode;
  hint?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  flush?: boolean;
  alwaysOpen?: boolean;
}

export function Collapsible({
  label,
  hint,
  defaultOpen = false,
  open,
  onToggle,
  flush,
  alwaysOpen = false,
  children,
  className,
  ...rest
}: PropsWithChildren<CollapsibleProps>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const resolvedOpen = alwaysOpen ? true : (open ?? uncontrolledOpen);
  const cls = [styles.root, className].filter(Boolean).join(' ');
  const contentCls = flush ? styles.contentFlush : styles.content;

  if (alwaysOpen) {
    const sectionProps = rest as HTMLAttributes<HTMLElement>;

    return (
      <section className={cls} {...sectionProps}>
        <div className={`${styles.summary} ${styles.summaryStatic}`}>
          <span className={styles.summaryLabel}>
            <span>{label}</span>
            {hint ? <span className={styles.summaryHint}>{hint}</span> : null}
          </span>
        </div>
        <div className={contentCls}>{children}</div>
      </section>
    );
  }

  return (
    <details
      className={cls}
      open={resolvedOpen}
      onToggle={(event) => {
        if (open === undefined) {
          setUncontrolledOpen(event.currentTarget.open);
        }
        onToggle?.(event);
      }}
      {...rest}
    >
      <summary className={styles.summary}>
        <span className={styles.summaryLabel}>
          <span>{label}</span>
          {hint ? <span className={styles.summaryHint}>{hint}</span> : null}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          <IconChevronDown size={16} />
        </span>
      </summary>
      <div className={contentCls}>{children}</div>
    </details>
  );
}
