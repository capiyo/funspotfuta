import { useEffect, useRef, useState } from 'react';

const ADSENSE_CLIENT_ID = 'ca-pub-4829747375056254';
const ADSENSE_LAYOUT_KEY = '-fb+5w+4e-db+86';

type AdSenseAdProps = {
  /** Existing AdSense in-feed unit slot created for the Funspot publisher. */
  slotId: string;
  // Placement labels are shared across public fixture discussions, the
  // channel-messaging carousel, feed, leaderboard, and voting modal.
  placement: 'feed' | 'chats' | 'leaderboard' | 'voting';
  enabled?: boolean;
};

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, never>>;
  }
}

/**
 * Browser-only AdSense unit. Kept under apps/web so native React Native never
 * imports browser APIs or receives AdSense identifiers.
 *
 * The wrapper collapses when AdSense reports an unfilled slot, and ads are
 * labelled separately from interactive voting/chat controls.
 */
export function AdSenseAd({ slotId, placement, enabled = true }: AdSenseAdProps) {
  const adRef = useRef<HTMLElement | null>(null);
  const pushedRef = useRef(false);
  const [status, setStatus] = useState<'pending' | 'filled' | 'unfilled'>('pending');

  useEffect(() => {
    if (
      !import.meta.env.PROD
      || !['funspot.co.ke', 'www.funspot.co.ke'].includes(window.location.hostname)
      || !enabled
      || !adRef.current
    ) {
      if (!enabled) pushedRef.current = false;
      return;
    }

    if (!pushedRef.current) {
      pushedRef.current = true;
      setStatus('pending');
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch {
        // Ad blockers, script load failures, and duplicate AdSense pushes should
        // never break voting, feed scrolling, leaderboard, or chat.
      }
    }

    // Keep polling even if React StrictMode replays the effect after cleanup.
    let attempts = 0;
    const poll = window.setInterval(() => {
      attempts += 1;
      const adStatus = adRef.current?.getAttribute('data-ad-status');
      if (adStatus === 'filled') {
        setStatus('filled');
        window.clearInterval(poll);
      } else if (adStatus === 'unfilled' || attempts >= 20) {
        setStatus('unfilled');
        window.clearInterval(poll);
      }
    }, 300);

    return () => window.clearInterval(poll);
  }, [enabled]);

  // Production ads are enabled by default on the verified canonical domains.
  // Set VITE_ADSENSE_ENABLED=false only to disable manually placed units; the
  // global loader remains scoped to funspot.co.ke/www.funspot.co.ke in main.tsx.
  if (
    !import.meta.env.PROD
    || import.meta.env.VITE_ADSENSE_ENABLED === 'false'
    || !enabled
    || !['funspot.co.ke', 'www.funspot.co.ke'].includes(window.location.hostname)
  ) return null;

  return (
    <aside
      className={`funspot-adsense funspot-adsense--${placement}`}
      aria-label="Advertisement"
      data-ad-placement={placement}
      style={{
        display: status === 'unfilled' ? 'none' : 'block',
        width: '100%',
        minWidth: 0,
        margin: '12px 0',
        padding: '8px 0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          color: 'var(--home-text-tertiary, #737373)',
          fontSize: 10,
          lineHeight: '14px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 4,
          visibility: status === 'filled' ? 'visible' : 'hidden',
        }}
      >
        Advertisement
      </div>
      <ins
        ref={(node) => { adRef.current = node; }}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: 100 }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format="fluid"
        data-ad-layout-key={ADSENSE_LAYOUT_KEY}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
