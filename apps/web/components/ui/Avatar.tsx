// Web port of RN src/components/ui/Avatar.tsx.
// Fixed size scale (sm/md/lg = 24/28/32px). Colors come from the CSS vars,
// so there is no `colors` prop — dark/light is handled by globals.css.

export const AVATAR_SIZES = { sm: 24, md: 28, lg: 32 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

export function Avatar({
  size = 'md',
  uri,
  label,
  borderColor,
  backgroundColor,
}: {
  size?: AvatarSize;
  /** Image URL. Takes priority over `label`. */
  uri?: string | null;
  /** Fallback when no `uri`: an initial or a single emoji. */
  label?: string;
  /** CSS color, e.g. 'var(--fan-primary)'. Team-tinted ring. */
  borderColor?: string;
  backgroundColor?: string;
}) {
  const dim = AVATAR_SIZES[size];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: dim,
        height: dim,
        backgroundColor: backgroundColor ?? 'var(--fan-primary-muted)',
        border: borderColor ? `1px solid ${borderColor}` : undefined,
      }}
    >
      {uri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={uri} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[12px] font-bold text-fan-primary">{label}</span>
      )}
    </span>
  );
}
