// Shared footer action pill — used by PostCard (like/comment/repost/share)
// and MatchCard (voters/likes/comments). One primitive, so a fix or a
// polish pass here shows up everywhere consistently.
//
// What changed vs. the flat version:
//   - Activation has real weight: on toggle-on, the icon overshoots and
//     settles (a single spring-ish bounce via an arbitrary cubic-bezier,
//     not a generic fade/scale-up-forever loop) instead of just swapping
//     color. It fires once, on the true->false->true transition, not on
//     every re-render.
//   - `toggle` marks pills that represent an on/off state (like, save) so
//     they get `aria-pressed` and the activation bounce. Non-toggle
//     actions (comment, share, repost) skip both — a screen reader
//     shouldn't hear "pressed: false" on a share button, and a bounce on
//     every share tap would be noise, not feedback.
//   - Numeric labels run through `formatCount` (1.2K, 3.4M) so a viral
//     post's like count can't blow out the pill's width or wrap.
//   - `loading` disables the button and swaps in a small inline spinner
//     in place of the icon — for pills wired to a network call (likes,
//     votes), so a slow tap can't be double-fired.
//   - Real focus-visible ring and disabled/opacity handling, so this is
//     usable via keyboard, not just pointer.

import { ReactNode, useEffect, useRef, useState } from 'react';

export function formatCount(n: number): string {
    if (n < 1000) return `${n}`;
    if (n < 1_000_000) {
        const v = n / 1000;
        return `${v >= 100 ? Math.round(v) : v.toFixed(v < 10 ? 1 : 0).replace(/\.0$/, '')}K`;
    }
    const v = n / 1_000_000;
    return `${v.toFixed(v < 10 ? 1 : 0).replace(/\.0$/, '')}M`;
}

export function FooterPill({
    icon,
    label,
    onClick,
    active = false,
    activeColor = 'text-fan-primary',
    activeBg,
    toggle = false,
    loading = false,
    disabled = false,
    ariaLabel,
}: {
    icon: ReactNode;
    /** String labels render as-is; numeric labels get compact-formatted (1.2K). */
    label?: string | number;
    onClick?: () => void;
    active?: boolean;
    /** Tailwind text-* class applied to icon + label when active. */
    activeColor?: string;
    /** Tailwind bg-* class for the tinted fill when active. Falls back to a plain surface. */
    activeBg?: string;
    /** Marks this as an on/off control (like, save) — adds aria-pressed and the activation bounce. Omit for one-shot actions (comment, share). */
    toggle?: boolean;
    /** Disables the button and shows a spinner in place of the icon. */
    loading?: boolean;
    disabled?: boolean;
    /** Falls back to `label` when omitted; supply this when the icon alone wouldn't tell a screen reader what the button does. */
    ariaLabel?: string;
}) {
    const [bounce, setBounce] = useState(false);
    const prevActive = useRef(active);

    useEffect(() => {
        if (toggle && active && !prevActive.current) {
            setBounce(true);
            const t = setTimeout(() => setBounce(false), 320);
            prevActive.current = active;
            return () => clearTimeout(t);
        }
        prevActive.current = active;
    }, [active, toggle]);

    const isDisabled = disabled || loading;
    const displayLabel =
        typeof label === 'number' ? formatCount(label) : label;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            aria-pressed={toggle ? active : undefined}
            aria-label={ariaLabel ?? (typeof displayLabel === 'string' ? displayLabel : undefined)}
            aria-busy={loading || undefined}
            className={[
                'inline-flex items-center gap-fan-xs rounded-fan-pill px-fan-md py-fan-xs text-[11.5px]',
                'transition-colors duration-150 ease-out',
                'active:scale-[0.92] transition-transform',
                'outline-none focus-visible:ring-2 focus-visible:ring-fan-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-fan-background',
                isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                active
                    ? `${activeBg ?? 'bg-fan-surfaceSunken'} ${activeColor}`
                    : 'bg-fan-surfaceSunken text-fan-textSecondary',
            ].join(' ')}
        >
            <span
                className={`flex h-[13px] w-[13px] items-center justify-center ${bounce
                    ? 'scale-[1.35] transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]'
                    : 'scale-100 transition-transform duration-150 ease-out'
                    }`}
            >
                {loading ? (
                    <span className="block h-[11px] w-[11px] animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-70" />
                ) : (
                    icon
                )}
            </span>
            {displayLabel !== undefined && displayLabel !== '' && (
                <span className="font-semibold tabular-nums">{displayLabel}</span>
            )}
        </button>
    );
}