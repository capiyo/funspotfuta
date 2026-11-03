// Web port of RN Segmentedcontrol.tsx (All / Live / Upcoming / Completed).

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div role="tablist" className="flex rounded-fan-md bg-fan-surfaceSunken p-[2px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 truncate rounded-fan-md py-1 text-center text-fan-button ${
              active ? 'bg-fan-surfaceElevated text-fan-textPrimary' : 'text-fan-textSecondary'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
