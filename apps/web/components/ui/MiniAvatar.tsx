'use client';
// Web port of RN miniAvatar.tsx — 24px, falls back to initial if the image errors.

import { useState } from 'react';

export function MiniAvatar({ label, uri }: { label: string; uri?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-fan-border bg-fan-surfaceSunken">
      {uri && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={uri} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-fan-tag text-fan-primary">{(label || '?').charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
