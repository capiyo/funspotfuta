// Web port of RN FeedItem.tsx — shared container for MatchCard / HistoryCard / PostCard:
// owns gutter, vertical rhythm and the hairline divider.

import { ReactNode } from 'react';

export function FeedItem({
  onClick,
  className = '',
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const cls = `flex flex-col gap-2 border-b border-fan-border bg-fan-background px-3 py-4 ${className}`;
  if (!onClick) return <div className={cls}>{children}</div>;
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()} className={`${cls} cursor-pointer transition-opacity hover:opacity-85`}>
      {children}
    </div>
  );
}
