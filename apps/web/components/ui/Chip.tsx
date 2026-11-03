// Web port of RN Chip.tsx. 'filter' = selectable pill, 'tag' = small inline label.

export function Chip({
  label,
  active = false,
  variant = 'filter',
  activeTextColor,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  active?: boolean;
  variant?: 'filter' | 'tag';
  /** CSS color for the label when active (default: inverse text). */
  activeTextColor?: string;
  /** 'tag' variant only. */
  tone?: 'neutral' | 'primary';
  onClick?: () => void;
}) {
  const bg = active
    ? 'bg-fan-primary'
    : variant === 'tag' && tone === 'primary'
      ? 'bg-fan-primaryDim'
      : 'bg-fan-surfaceSunken';
  const pad = variant === 'tag' ? 'px-2 py-[2px]' : 'px-3 py-1';
  const font = variant === 'tag' ? 'text-fan-tag' : 'text-fan-caption';
  const textColor = active
    ? 'text-fan-textInverse'
    : tone === 'primary'
      ? 'text-fan-primary'
      : 'text-fan-textSecondary';

  const cls = `inline-flex items-center rounded-fan-pill ${bg} ${pad} ${font} ${textColor}`;
  const style = active && activeTextColor ? { color: activeTextColor } : undefined;

  if (!onClick) return <span className={cls} style={style}>{label}</span>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${cls} transition-opacity hover:opacity-85`} style={style}>
      {label}
    </button>
  );
}
