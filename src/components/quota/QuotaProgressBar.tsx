import styles from './QuotaProgressBar.module.scss';

export interface QuotaProgressBarProps {
  percent: number | null;
  highThreshold: number;
  mediumThreshold: number;
}

export function QuotaProgressBar({
  percent,
  highThreshold,
  mediumThreshold,
}: QuotaProgressBarProps) {
  const normalized = percent === null ? null : Math.min(100, Math.max(0, percent));
  const fillClass =
    normalized === null
      ? styles.medium
      : normalized >= highThreshold
        ? styles.high
        : normalized >= mediumThreshold
          ? styles.medium
          : styles.low;
  const widthPercent = Math.round((normalized ?? 0) * 100) / 100;

  return (
    <div className={styles.bar}>
      <div className={`${styles.fill} ${fillClass}`} style={{ width: `${widthPercent}%` }} />
    </div>
  );
}
