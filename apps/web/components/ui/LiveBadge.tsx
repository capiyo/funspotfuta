// Web port of RN LiveBadge.tsx — the one live indicator.

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-[2px] rounded-fan-pill bg-fan-awayDim px-1 py-px text-fan-tag text-fan-live">
      <span className="h-[6px] w-[6px] rounded-full bg-fan-live" />
      Live
    </span>
  );
}
