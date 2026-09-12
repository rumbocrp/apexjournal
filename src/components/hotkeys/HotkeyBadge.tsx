import React from 'react';
import { useHotkeys } from '../../context/HotkeyContext';

interface HotkeyBadgeProps {
  actionId: string;
  className?: string;
  variant?: 'default' | 'subtle' | 'accent';
}

export const HotkeyBadge: React.FC<HotkeyBadgeProps> = ({
  actionId,
  className = '',
  variant = 'default',
}) => {
  const { getDisplayCombo } = useHotkeys();
  const combo = getDisplayCombo(actionId);

  if (!combo) return null;

  let variantStyle = 'bg-surface-primary text-obsidian-400 border-surface-border';
  if (variant === 'subtle') {
    variantStyle = 'bg-transparent text-obsidian-500 border-transparent';
  } else if (variant === 'accent') {
    variantStyle = 'bg-surface-secondary text-obsidian-200 border-surface-borderSubtle';
  }

  return (
    <kbd
      className={`inline-flex items-center justify-center font-mono text-[9px] font-medium px-1 py-0.2 rounded border select-none tabular-nums shadow-xs ${variantStyle} ${className}`}
      title={`Atajo de teclado: ${combo}`}
      aria-label={`Atajo de teclado: ${combo}`}
    >
      {combo}
    </kbd>
  );
};
