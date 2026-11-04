import { MessageCircle, Newspaper } from 'lucide-react';
import { useFanColors } from '@/theme/use-fan-colors';
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
          aria-label={name}
          title={name}
          style={{ background: isActive ? colors.primary : 'transparent', borderRadius: '50%', width: 44, height: 44, padding: 0, color: isActive ? colors.textInverse : colors.textTertiary }}
        >
          <Icon size={16} aria-hidden="true" />
        </button>;
      })}
    </div>
  </nav>;
}
