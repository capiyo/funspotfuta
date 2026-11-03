import { MessageCircle, Newspaper } from 'lucide-react';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';

export type TabName = 'Chats' | 'Feed';
const TABS: TabName[] = ['Chats', 'Feed'];
const ICONS = { Chats: MessageCircle, Feed: Newspaper } as const;

export function FloatingPillTabBar({ active, onChange }: {
  active: TabName;
  onChange: (tab: TabName) => void;
}) {
  const colors = useFanColors();
  return <nav className="floating-pill-wrap" aria-label="Main navigation">
    <div className="floating-pill" style={{ background: colors.surfaceElevated, borderRadius: FAN_RADIUS.pill, padding: FAN_SPACING.xs }}>
      {TABS.map((name) => {
        const isActive = active === name;
        const Icon = ICONS[name];
        return <button
          key={name}
          type="button"
          aria-current={isActive ? 'page' : undefined}
          onClick={() => { if (!isActive) onChange(name); }}
          className={isActive ? 'floating-pill-item active' : 'floating-pill-item'}
          style={{ background: isActive ? colors.primary : 'transparent', borderRadius: FAN_RADIUS.pill, padding: `${FAN_SPACING.sm + 2}px ${FAN_SPACING.base}px`, color: isActive ? colors.textInverse : colors.textTertiary }}
        >
          <Icon size={16} aria-hidden="true" />
          <span style={fanText('tag', colors, isActive ? colors.textInverse : colors.textTertiary)}>{name.toLowerCase()}</span>
        </button>;
      })}
    </div>
  </nav>;
}
