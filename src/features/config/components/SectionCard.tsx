import type { ReactNode } from 'react';
import { FIELDS_ROOT_CLASS } from './fields/fieldClasses';
import styles from './SectionCard.module.scss';

export type SectionCardProps = {
  /** 分区序号（01–07）。常用 tab 是别名视图，不传即不显示。 */
  indexLabel?: string;
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** 仅首载入场为 true（页面挂载时用 useState 捕获），tab 切换零动画不重播。 */
  animateIn?: boolean;
  children: ReactNode;
};

/**
 * 分区卡片：自然高度纵向流。
 * 表面配方与全站卡片一致：8px 圆角 / 1px 描边 / 82% color-mix。
 *
 * 卡头整体可选：「常用」是 tabs 的别名视图，标题已由 tab 承载，
 * 再渲染一遍会和上方 tabs 读成重复，因此该视图直接省略卡头。
 */
export function SectionCard({
  indexLabel,
  icon,
  title,
  description,
  animateIn = false,
  children,
}: SectionCardProps) {
  const hasHeading = Boolean(indexLabel || icon || title || description);

  return (
    <section className={`${styles.card} ${animateIn ? styles.cardEnter : ''}`}>
      {hasHeading ? (
        <header className={styles.header}>
          <div className={styles.badges}>
            {indexLabel ? <span className={styles.indexBadge}>{indexLabel}</span> : null}
            {icon ? <span className={styles.iconBadge}>{icon}</span> : null}
          </div>
          <div className={styles.heading}>
            {title ? <h2 className={styles.title}>{title}</h2> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
        </header>
      ) : null}
      <div className={`${styles.content} ${FIELDS_ROOT_CLASS}`}>{children}</div>
    </section>
  );
}
