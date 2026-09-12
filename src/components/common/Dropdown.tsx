import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  fullWidth?: boolean;
  hideChevron?: boolean;
  align?: 'left' | 'right';
}

/**
 * Journal-native dropdown (shadcn dropdown-menu anatomy: trigger + content +
 * items, rendered in-app so it never inherits OS chrome).
 * Surfaces, radii, type and focus behavior follow the journal tokens;
 * the selected item mirrors the Sidebar active-row treatment.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = 'Seleccionar',
  className = '',
  triggerClassName = '',
  fullWidth = true,
  hideChevron = false,
  align = 'left',
}) => {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const label = selectedIndex >= 0 ? options[selectedIndex].label : placeholder;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open ]);

  useEffect(() => {
    if (open) {
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (open && focusedIndex >= 0) {
      itemRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, focusedIndex]);

  const select = (v: string) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (v !== value) onChange(v);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        select(options[focusedIndex].value);
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? 'w-full' : 'w-auto'} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-300 hover:border-surface-borderHighlight transition-fast ${triggerClassName}`}
      >
        <span className="truncate">{label}</span>
        {!hideChevron && <ChevronDown className="w-3.5 h-3.5 text-obsidian-500 shrink-0" />}
      </button>

      {open && options.length > 0 && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className={`absolute z-50 mt-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          } min-w-full max-h-56 overflow-auto py-1 bg-surface-primary border border-surface-border rounded-md shadow-modal`}
        >
          {options.map((opt, idx) => {
            const selected = opt.value === value;
            const focused = idx === focusedIndex;
            return (
              <button
                key={opt.value}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => select(opt.value)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-left transition-fast ${
                  selected
                    ? 'bg-surface-secondary text-obsidian-100 font-semibold'
                    : 'text-obsidian-300'
                } ${focused && !selected ? 'bg-surface-hover' : ''}`}
              >
                <span className="truncate">{opt.label}</span>
                {selected && <Check className="w-3 h-3 text-obsidian-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
