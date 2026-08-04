import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { IconChevronDown } from './icons';
import styles from './AutocompleteInput.module.scss';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[] | { value: string; label?: string }[];
  placeholder: string;
  disabled?: boolean;
  wrapperStyle?: CSSProperties;
  id?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  wrapperStyle,
  id,
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;

  const normalizedOptions = options.map((opt) =>
    typeof opt === 'string'
      ? { value: opt, label: opt }
      : { value: opt.value, label: opt.label || opt.value }
  );

  const searchValue = value.toLowerCase();
  const filteredOptions = normalizedOptions.filter((opt) => {
    return (
      opt.value.toLowerCase().includes(searchValue) || opt.label.toLowerCase().includes(searchValue)
    );
  });
  const dropdownOpen = isOpen && filteredOptions.length > 0 && !disabled;
  const activeDescendant =
    dropdownOpen && highlightedIndex >= 0 ? `${inputId}-option-${highlightedIndex}` : undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div className="form-group" ref={containerRef} style={wrapperStyle}>
      <div className={styles.control}>
        <input
          id={inputId}
          className={`input ${styles.input}`}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={dropdownOpen}
          aria-controls={dropdownOpen ? listboxId : undefined}
          aria-activedescendant={activeDescendant}
        />
        <button
          type="button"
          className={styles.toggle}
          disabled={disabled}
          tabIndex={-1}
          aria-label={placeholder}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-controls={dropdownOpen ? listboxId : undefined}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <IconChevronDown
            size={16}
            className={`${styles.chevron} ${dropdownOpen ? styles.chevronOpen : ''}`}
          />
        </button>

        {dropdownOpen && (
          <div className={styles.dropdown} id={listboxId} role="listbox">
            {filteredOptions.map((opt, index) => (
              <button
                type="button"
                key={`${opt.value}-${index}`}
                id={`${inputId}-option-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={opt.value === value}
                className={`${styles.option} ${
                  index === highlightedIndex ? styles.optionHighlighted : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className={styles.optionValue}>{opt.value}</span>
                {opt.label !== opt.value && <span className={styles.optionLabel}>{opt.label}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
