// Web port of RN ActionButton.tsx. Icon + optional count; static (non-button) when onClick is omitted.

import type { LucideIcon } from 'lucide-react';

export function ActionButton({
  icon: Icon,
  count,
  active = false,
  activeColor,
  label,
  onClick,
}: {
  icon: LucideIcon;
  count?: number;
  active?: boolean;
  /** CSS color when active (default: primary). */
  activeColor?: string;
  /** Accessible label, e.g. "Like". */
  label: string;
  onClick?: () => void;
}) {
  const color = active ? activeColor ?? 'var(--fan-primary)' : 'var(--fan-text-secondary)';
  const content = (
    <>
      <Icon size={14} color={color} fill={active ? color : 'none'} />
      {count !== undefined && (
        <span className="text-fan-caption" style={{ color }}>
          {count}
        </span>
      )}
    </>
  );

  if (!onClick) {
    return (
      <span
        className="inline-flex items-center gap-[2px]"
        aria-label={`${label}${count !== undefined ? `: ${count}` : ''}`}
      >
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-[2px] p-2 -m-2 transition-opacity hover:opacity-70"
    >
      {content}
    </button>
  );
}
