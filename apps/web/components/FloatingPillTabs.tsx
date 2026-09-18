'use client';
// Web equivalent of RN's floating pill tab bar, for narrow viewports.
export function FloatingPillTabs({
  active,
  onChange,
}: {
  active: 'arena' | 'feed' | 'logs';
  onChange: (t: 'arena' | 'feed' | 'logs') => void;
}) {
  const tabs = ['arena', 'feed', 'logs'] as const;
  return (
    <div className="fixed bottom-fan-lg left-0 right-0 flex justify-center">
      <div className="flex gap-fan-xs rounded-fan-pill bg-fan-surfaceElevated p-fan-xs shadow-lg">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`rounded-fan-pill px-fan-base py-fan-sm text-fan-tag ${
              active === t ? 'bg-fan-primary text-fan-textInverse' : 'text-fan-textTertiary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
