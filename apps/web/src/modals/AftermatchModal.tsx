import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Share2 } from 'lucide-react';
import { useAftermatch, type AftermatchData, type Fixture } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

type TabKey = 'votes' | 'pledges' | 'bets' | 'subfixtures';
export function AftermatchReviewModal({
  visible, fixture, userId, username, authToken, channelId, isLoggedIn,
  showPledgesTab = true, showBetsTab = true, showSubFixturesTab = true, onClose,
}: {
  visible: boolean; fixture: Fixture; userId: string; username: string; authToken: string | null;
  channelId: string; isLoggedIn: boolean; showPledgesTab?: boolean; showBetsTab?: boolean;
  showSubFixturesTab?: boolean; onClose: () => void;
}) {
  const colors = useFanColors();
  const dialog = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, refetch } = useAftermatch(fixture, channelId, authToken);
  const [tab, setTab] = useState<TabKey>('votes');
  const tabs = useMemo(() => [
    { key: 'votes' as const, label: 'Votes', enabled: true },
    { key: 'pledges' as const, label: 'Pledges', enabled: showPledgesTab },
    { key: 'bets' as const, label: 'Bets', enabled: showBetsTab },
    { key: 'subfixtures' as const, label: 'Subs', enabled: showSubFixturesTab },
  ].filter((item) => item.enabled), [showPledgesTab, showBetsTab, showSubFixturesTab]);
  useEffect(() => {
    if (!visible) return;
    const prior = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prior?.focus(); };
  }, [visible, onClose]);
  if (!visible) return null;
  const entries: any[] = !data ? [] : tab === 'votes' ? data.voters : tab === 'pledges' ? data.pledges : tab === 'bets' ? data.bets : data.subFixtures;
  function shareResults() {
    const text = `${fixture.homeTeam} vs ${fixture.awayTeam} — match review`;
    if (navigator.share) void navigator.share({ title: 'Match Review', text }).catch(() => undefined);
    else void navigator.clipboard?.writeText(text);
  }
  return createPortal(<div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="Match Review" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl" style={{ background: colors.surface, color: colors.textPrimary, border: `1px solid ${colors.border}` }}>
      <header className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: colors.border }}><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: colors.primaryDim }}>🏆</div><div className="min-w-0 flex-1"><h2 className="text-base font-bold">Match Review</h2><p className="truncate text-xs" style={{ color: colors.textTertiary }}>{fixture.homeTeam} vs {fixture.awayTeam}</p></div><button type="button" onClick={onClose} aria-label="Close review" className="rounded-full p-2" style={{ background: colors.surfaceSunken }}><X size={16}/></button></header>
      {data && <div className="grid grid-cols-3 gap-2 px-5 py-4"><div className="rounded-xl p-3 text-center" style={{ background: colors.surfaceSunken }}><p className="text-[10px]" style={{ color: colors.textTertiary }}>Home</p><strong className="text-sm">{fixture.homeScore ?? '—'}</strong></div><div className="rounded-xl p-3 text-center" style={{ background: colors.primaryDim }}><p className="text-[10px]" style={{ color: colors.primary }}>Result</p><strong className="text-xs">{data.winner ?? 'Final'}</strong></div><div className="rounded-xl p-3 text-center" style={{ background: colors.surfaceSunken }}><p className="text-[10px]" style={{ color: colors.textTertiary }}>Away</p><strong className="text-sm">{fixture.awayScore ?? '—'}</strong></div></div>}
      <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2" style={{ borderColor: colors.border }}>{tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className="rounded-full px-4 py-2 text-xs font-bold" style={{ background: tab === item.key ? colors.primaryDim : 'transparent', color: tab === item.key ? colors.primary : colors.textSecondary }}>{item.label}</button>)}</nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{isLoading ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: colors.textTertiary }}><RefreshCw size={16} className="animate-spin"/> Loading match review…</p> : isError || !data ? <div className="py-10 text-center"><p className="text-sm" style={{ color: colors.away }}>Unable to load match review.</p><button type="button" onClick={() => void refetch()} className="mt-3 rounded-lg border px-4 py-2 text-xs" style={{ borderColor: colors.border }}>Retry</button></div> : entries.length === 0 ? <p className="py-10 text-center text-sm" style={{ color: colors.textTertiary }}>No {tab === 'subfixtures' ? 'sub-fixture results' : tab} to show.</p> : entries.map((entry: any, index: number) => <article key={String(entry.id ?? entry.userId ?? entry.user_id ?? index)} className="mb-2 rounded-xl border p-3" style={{ borderColor: colors.border, background: colors.surfaceSunken }}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{entry.userName ?? entry.username ?? entry.user_name ?? entry.marketType ?? entry.title ?? 'Result'}</span><strong className="text-xs">{entry.selection ?? entry.result ?? entry.amount ?? entry.status ?? ''}</strong></div>{entry.amount != null && <p className="mt-1 text-xs" style={{ color: colors.textTertiary }}>Amount: {entry.amount}</p>}</article>)}</div>
      <footer className="flex gap-2 border-t p-4" style={{ borderColor: colors.border }}><button type="button" onClick={shareResults} className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold" style={{ borderColor: colors.border }}><Share2 size={14}/> Share Results</button><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-bold" style={{ background: colors.primary, color: '#fff' }}>Close</button></footer>
    </section>
  </div>, document.body);
}
export default AftermatchReviewModal;
