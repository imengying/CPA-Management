import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { InfoTip } from './Tooltip';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  /**
   * 字段说明。有 `label` 时作为 label 后的 InfoTip 呈现，同时以视觉隐藏副本留在 DOM 里，
   * 让输入框保持 aria-describedby 关联；没有 `label` 就无处挂提示，只能常驻可见。
   */
  hint?: ReactNode;
  /**
   * 与 `hint` 无关、始终留在输入框下方的一行。给必须留在页面上的内容：安全提示、
   * 破坏性后果，以及含链接等可交互内容的说明（提示里键盘够不到）。同样会描述输入框。
   */
  note?: ReactNode;
  error?: string;
  rightElement?: ReactNode;
  size?: 'sm' | 'md';
}

export function Input({
  label,
  hint,
  note,
  error,
  rightElement,
  size = 'md',
  className = '',
  id,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const noteId = note ? `${inputId}-note` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [rest['aria-describedby'], errorId, hintId, noteId].filter(Boolean).join(' ') || undefined;
  const hintInTooltip = Boolean(hint && label);

  return (
    <div className="form-group">
      {label &&
        (hintInTooltip ? (
          <div className="form-label-row">
            <label htmlFor={inputId}>{label}</label>
            <InfoTip content={hint} label={label} descriptionId={hintId} />
          </div>
        ) : (
          <label htmlFor={inputId}>{label}</label>
        ))}
      <div className="input-control">
        <input
          id={inputId}
          className={`input ${size === 'sm' ? 'input-sm' : ''} ${
            rightElement ? 'input-with-right-element' : ''
          } ${className}`.trim()}
          aria-invalid={Boolean(error) || rest['aria-invalid']}
          aria-describedby={describedBy}
          {...rest}
        />
        {rightElement && <div className="input-right-element">{rightElement}</div>}
      </div>
      {hint && (
        <div id={hintId} className={hintInTooltip ? 'hint visually-hidden-focusable' : 'hint'}>
          {hint}
        </div>
      )}
      {note && (
        <div id={noteId} className="hint">
          {note}
        </div>
      )}
      {error && (
        <div id={errorId} className="error-box">
          {error}
        </div>
      )}
    </div>
  );
}
