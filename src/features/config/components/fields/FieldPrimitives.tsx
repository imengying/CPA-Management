import { useId, type ReactNode } from 'react';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { InfoTip } from '@/components/ui/Tooltip';
import { configFieldDomId } from '../../searchIndex';
import styles from './Field.module.scss';

export type ToggleRowProps = {
  title: string;
  /** 行说明：默认收进标题后的 InfoTip，同时以视觉隐藏副本留给读屏。 */
  description?: ReactNode;
  /** 让说明作为可见的一行留在标题下方，只给「不读就会出错」的说明用。 */
  keepDescriptionVisible?: boolean;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

export function ToggleRow({
  title,
  description,
  keepDescriptionVisible = false,
  checked,
  disabled,
  onChange,
}: ToggleRowProps) {
  const visible = Boolean(description) && keepDescriptionVisible;
  const descriptionId = useId();
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleCopy}>
        <div className={styles.toggleTitle}>
          {title}
          {description && !keepDescriptionVisible ? (
            <InfoTip content={description} label={title} descriptionId={descriptionId} />
          ) : null}
        </div>
        {description ? (
          <div
            id={descriptionId}
            className={
              visible
                ? styles.toggleDescription
                : `${styles.toggleDescription} visually-hidden-focusable`
            }
          >
            {description}
          </div>
        ) : null}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className={styles.fieldGrid}>{children}</div>;
}

export function FieldStack({ children }: { children: ReactNode }) {
  return <div className={styles.fieldStack}>{children}</div>;
}

export function Divider() {
  return <div className={styles.divider} />;
}

// Stable, stateless anchor around a searchable field. Search jumps target its DOM id
// (see searchIndex.ts) and the highlight pulse is applied to it imperatively.
export function FieldAnchor({
  fieldId,
  children,
  wide = false,
}: {
  fieldId: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      id={configFieldDomId(fieldId)}
      className={`${styles.fieldAnchor} ${wide ? styles.fieldAnchorWide : ''}`.trim()}
    >
      {children}
    </div>
  );
}

/** 带描边容器的字段组（原 SectionSubsection / .subsection）。title 可省略只留容器。 */
export function FieldGroup({
  title,
  description,
  keepDescriptionVisible = false,
  children,
}: {
  title?: string;
  description?: ReactNode;
  /** 组说明默认收进组标题后的 InfoTip；需要常驻页面时置 true。 */
  keepDescriptionVisible?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.group}>
      {title ? (
        <div className={styles.groupHeader}>
          <h3 className={styles.groupTitle}>
            {title}
            {description && !keepDescriptionVisible ? (
              <InfoTip content={description} label={title} />
            ) : null}
          </h3>
          {description && keepDescriptionVisible ? (
            <p className={styles.groupDescription}>{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** 独立的小组标题行（如 Claude / Codex 请求头小节标题）。 */
export function FieldGroupHeading({ title }: { title: string }) {
  return (
    <div className={styles.groupHeader}>
      <h3 className={styles.groupTitle}>{title}</h3>
    </div>
  );
}

export function FieldShell({
  label,
  labelId,
  htmlFor,
  hint,
  hintId,
  keepHintVisible = false,
  error,
  errorId,
  children,
}: {
  label: string;
  labelId?: string;
  htmlFor?: string;
  hint?: ReactNode;
  hintId?: string;
  keepHintVisible?: boolean;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.fieldShell}>
      {/* InfoTip 必须与 label 同级：放进 <label> 内会被拼进控件的可访问名称 */}
      <label id={labelId} htmlFor={htmlFor} className={styles.fieldLabel}>
        {label}
      </label>
      {hint && !keepHintVisible ? (
        <InfoTip content={hint} label={label} descriptionId={hintId} />
      ) : null}
      {children}
      {error ? (
        <div id={errorId} className="error-box">
          {error}
        </div>
      ) : null}
      {hint ? (
        <div
          id={hintId}
          className={
            keepHintVisible ? styles.fieldHint : `${styles.fieldHint} visually-hidden-focusable`
          }
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** 独立的字段提示行（FieldShell 之外的裸 hint）。 */
export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className={styles.fieldHint}>
      {children}
    </div>
  );
}

/** 数字输入右侧的「已禁用」pill 宿主（流式 keepalive 的 0/空 提示）。 */
export function FieldControl({ children }: { children: ReactNode }) {
  return <div className={styles.fieldControl}>{children}</div>;
}

/** FieldControl 内的内联 pill。 */
export function InlinePill({ children }: { children: ReactNode }) {
  return <span className={styles.inlinePill}>{children}</span>;
}
