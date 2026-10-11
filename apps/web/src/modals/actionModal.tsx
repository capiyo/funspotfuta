import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Wallet, Users, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useFanColors } from '@/theme/use-fan-colors';

type Selection = 'home' | 'away';
type Result = boolean | { success: boolean; message?: string; newBalance?: number };
type PayResult = { success: boolean; newBalance?: number; error?: string; message?: string };
type FixtureLite = { id: string; matchId: string; homeTeam: string; awayTeam: string; league: string; isLive?: boolean };
type Market = { id: string; marketType?: string; options?: string[]; status?: string; result?: string; pledgeCounts?: Record<string, number>; pledgeTotals?: Record<string, number> };
type Pledge = { id?: string; betId?: string; userId?: string; userName?: string; username?: string; selection?: string; amount?: number; status?: string };
type Props = {
  visible: boolean; fixture: FixtureLite; userId: string; username: string; authToken?: string | null;
  isLoggedIn: boolean; hasUserVoted: boolean; userVoteSelection?: string | null; channelId: string;
  showPledgesTab?: boolean; showSubFixturesTab?: boolean; showBetsTab?: boolean; onClose: () => void;
  onVote: (selection: Selection) => Promise<Result>; onPledge: (selection: Selection, amount: number) => Promise<Result>;
  onShowJoinGroups?: () => void;
  fetchVoters: (fixtureId: string, authToken?: string | null) => Promise<any[]>;
  fetchPledges: (channelId: string, fixtureId: string, authToken?: string | null) => Promise<any[]>;
  fetchSubFixtures: (fixtureId: string, authToken?: string | null) => Promise<Market[]>;
  fetchSubFixturePledges: (marketId: string, fixtureId: string, authToken?: string | null) => Promise<Pledge[]>;
  fetchBets: (channelId: string, fixtureId: string, authToken?: string | null) => Promise<any[]>;
  fetchBalance: (userId: string, authToken?: string | null, opts?: { forceRefresh?: boolean }) => Promise<number>;
  topUp: (amount: number, phone: string, purpose: string) => Promise<PayResult>;
  withdraw: (amount: number, phone: string) => Promise<PayResult>;
  getSavedPhone: (kind: 'topup' | 'withdraw') => Promise<string | null>;
  savePhone: (kind: 'topup' | 'withdraw', phone: string) => Promise<boolean>;
  getUserPhone: () => Promise<string>;
  placeSubFixturePledge: (args: { fixtureId: string; marketId: string; starterId: string; starterName: string; selection: string; amount: number }) => Promise<{ success: boolean; message?: string }>;
  matchSubFixturePledge: (args: { betId: string; matchId: string; marketId: string; finisherId: string; finisherName: string; selection: string; amount: number }) => Promise<{ success: boolean; message?: string }>;
  matchMainPledge: (args: { betId: string; finisherId: string; finisherName: string; finisherSelection: Selection; amount: number }) => Promise<{ success: boolean; message?: string }>;
};
type Tab = 'vote' | 'pledges' | 'subs' | 'bets';

export function SwipeableVotePledgeModal(props: Props) {
  const colors = useFanColors();
  const dialog = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('vote');
  const [selection, setSelection] = useState<Selection>('home');
  const [amount, setAmount] = useState('10');
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [voters, setVoters] = useState<any[]>([]);
  const [pledges, setPledges] = useState<any[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  const [marketPledges, setMarketPledges] = useState<Record<string, Pledge[]>>({});
  const [fundsMode, setFundsMode] = useState<'topup' | 'withdraw' | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!props.visible) return;
    const prior = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
      if (event.key !== 'Tab' || !dialog.current) return;
      const items = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); prior?.focus(); };
  }, [props.visible, props.onClose]);

  useEffect(() => {
    if (!props.visible) return;
    let alive = true;
    setBusy(true); setError('');
    Promise.all([
      props.fetchVoters(props.fixture.matchId || props.fixture.id, props.authToken),
      props.fetchPledges(props.channelId, props.fixture.matchId || props.fixture.id, props.authToken),
      props.fetchSubFixtures(props.fixture.matchId || props.fixture.id, props.authToken),
      props.fetchBets(props.channelId, props.fixture.matchId || props.fixture.id, props.authToken),
      props.userId ? props.fetchBalance(props.userId, props.authToken).catch((e) => { if (alive) setError(e?.message ?? 'Unable to load balance'); return null; }) : Promise.resolve(null),
    ]).then(([v,p,m,b,bal]) => {
      if (!alive) return;
      setVoters(Array.isArray(v) ? v : []);
      setPledges(Array.isArray(p) ? p : []);
      setMarkets(Array.isArray(m) ? m : []);
      setBets(Array.isArray(b) ? b : []);
      setBalance(typeof bal === 'number' ? bal : null);
    }).catch((e) => { if (alive) setError(e?.message ?? 'Unable to load match markets'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [props.visible, props.fixture.id, props.fixture.matchId, props.channelId, props.userId, props.authToken]);

  async function runAction(action: () => Promise<Result>) {
    if (!props.isLoggedIn) { setError('Please sign in to continue'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await action();
      const normalized = typeof result === 'boolean' ? { success: result } : result;
      if (!normalized?.success) throw new Error(normalized?.message || 'The request could not be completed');
      setNotice(normalized.message || 'Success');
      if (typeof normalized.newBalance === 'number') setBalance(normalized.newBalance);
      const [v,p,m,b,bal] = await Promise.all([
        props.fetchVoters(props.fixture.matchId || props.fixture.id, props.authToken),
        props.fetchPledges(props.channelId, props.fixture.matchId || props.fixture.id, props.authToken),
        props.fetchSubFixtures(props.fixture.matchId || props.fixture.id, props.authToken),
        props.fetchBets(props.channelId, props.fixture.matchId || props.fixture.id, props.authToken),
        props.fetchBalance(props.userId, props.authToken, { forceRefresh: true }).catch(() => null),
      ]);
      setVoters(Array.isArray(v) ? v : []); setPledges(Array.isArray(p) ? p : []);
      setMarkets(Array.isArray(m) ? m : []); setBets(Array.isArray(b) ? b : []);
      if (typeof bal === 'number') setBalance(bal);
    } catch (e) { setError(e instanceof Error ? e.message : 'The request could not be completed'); }
    finally { setBusy(false); }
  }

  async function loadMarket(market: Market) {
    const marketId = String(market.id);
    try {
      const list = await props.fetchSubFixturePledges(marketId, props.fixture.matchId || props.fixture.id, props.authToken);
      setMarketPledges((previous) => ({ ...previous, [marketId]: Array.isArray(list) ? list : [] }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load market pledges'); }
  }

  async function submitFunds(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(fundAmount);
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a valid amount'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (!phone.trim()) throw new Error('Enter your phone number');
      const result = fundsMode === 'topup'
        ? await props.topUp(value, phone.trim(), 'chat_vote')
        : await props.withdraw(value, phone.trim());
      if (!result.success) throw new Error(result.error || result.message || 'Transaction failed');
      if (typeof result.newBalance === 'number') setBalance(result.newBalance);
      setFundsMode(null); setFundAmount(''); setNotice('Transaction successful');
    } catch (e) { setError(e instanceof Error ? e.message : 'Transaction failed'); }
    finally { setBusy(false); }
  }

  if (!props.visible) return null;
  const tabList: { key: Tab; label: string; enabled: boolean }[] = [
    { key: 'vote', label: 'Vote', enabled: true },
    { key: 'pledges', label: 'Pledges', enabled: props.showPledgesTab !== false },
    { key: 'subs', label: 'Sub-fixtures', enabled: props.showSubFixturesTab !== false },
    { key: 'bets', label: 'Bets', enabled: props.showBetsTab !== false },
  ];
  return createPortal(<div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="Vote and pledge" className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl" style={{ background: colors.surface, color: colors.textPrimary, border: `1px solid ${colors.border}` }}>
      <header className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: colors.border }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: colors.primaryDim }}>⚽</div>
        <div className="min-w-0 flex-1"><h2 className="text-base font-bold">Match action</h2><p className="truncate text-xs" style={{ color: colors.textTertiary }}>{props.fixture.homeTeam} vs {props.fixture.awayTeam}</p></div>
        <button type="button" onClick={props.onClose} aria-label="Close" className="rounded-full p-2" style={{ background: colors.surfaceSunken }}><X size={16}/></button>
      </header>
      <div className="flex gap-1 overflow-x-auto border-b px-3 py-2" style={{ borderColor: colors.border }}>
        {tabList.filter((item) => item.enabled).map((item) => <button type="button" key={item.key} onClick={() => setTab(item.key)} className="shrink-0 rounded-full px-4 py-2 text-xs font-bold" style={{ background: tab === item.key ? colors.primaryDim : 'transparent', color: tab === item.key ? colors.primary : colors.textSecondary }}>{item.label}</button>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: colors.surfaceSunken }}>
          <div><p className="text-[10px] uppercase tracking-wider" style={{ color: colors.textTertiary }}>Available balance</p><p className="mt-1 text-lg font-bold">{balance === null ? '—' : balance.toLocaleString()}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => { setFundsMode('topup'); setFundAmount(''); setError(''); }} className="rounded-full px-3 py-2 text-xs font-bold" style={{ background: colors.primary, color: '#fff' }}>Top up</button><button type="button" onClick={() => { setFundsMode('withdraw'); setFundAmount(''); setError(''); }} className="rounded-full border px-3 py-2 text-xs font-bold" style={{ borderColor: colors.border }}>Withdraw</button></div>
        </div>
        {tab === 'vote' && <div className="space-y-4">
          <p className="text-sm" style={{ color: colors.textSecondary }}>{props.hasUserVoted ? `Your vote: ${props.userVoteSelection ?? 'recorded'}` : 'Choose the team you think will win.'}</p>
          <div className="grid grid-cols-2 gap-3">{(['home','away'] as const).map((side) => <button type="button" key={side} onClick={() => setSelection(side)} className="rounded-2xl border p-4 text-left" style={{ borderColor: selection === side ? colors.primary : colors.border, background: selection === side ? colors.primaryDim : colors.surfaceSunken }}><span className="block text-[10px] font-bold uppercase" style={{ color: selection === side ? colors.primary : colors.textTertiary }}>{side === 'home' ? 'Home' : 'Away'}</span><strong className="mt-2 block text-sm">{side === 'home' ? props.fixture.homeTeam : props.fixture.awayTeam}</strong></button>)}</div>
          <button type="button" disabled={busy || props.hasUserVoted} onClick={() => void runAction(() => props.onVote(selection))} className="w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50" style={{ background: colors.primary, color: '#fff' }}>{busy ? 'Please wait…' : props.hasUserVoted ? 'Vote recorded' : 'Cast vote'}</button>
          <div><label className="mb-2 block text-xs font-semibold">Pledge amount</label><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor: colors.border, background: colors.surfaceSunken, color: colors.textPrimary }}/><button type="button" disabled={busy || !Number.isFinite(Number(amount)) || Number(amount) <= 0} onClick={() => void runAction(() => props.onPledge(selection, Number(amount)))} className="mt-3 w-full rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50" style={{ borderColor: colors.primary, color: colors.primary }}>{busy ? 'Please wait…' : 'Place pledge'}</button></div>
        </div>}
        {tab === 'pledges' && <DataList title="Pledges" rows={pledges} empty="No pledges available yet." colors={colors} />}
        {tab === 'bets' && <DataList title="Bets" rows={bets} empty="No bets available yet." colors={colors} />}
        {tab === 'subs' && <div className="space-y-3">{markets.length === 0 && !busy ? <p className="py-8 text-center text-sm" style={{ color: colors.textTertiary }}>No sub-fixture markets available.</p> : markets.map((market) => <article key={market.id} className="rounded-xl border p-4" style={{ borderColor: colors.border }}><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">{String(market.marketType ?? 'Market').replace(/_/g, ' ')}</h3><p className="mt-1 text-xs" style={{ color: colors.textTertiary }}>{market.status ?? 'Open'}{market.result ? ` · Result: ${market.result}` : ''}</p></div><button type="button" onClick={() => void loadMarket(market)} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: colors.border }}>View pledges</button></div><div className="mt-3 flex flex-wrap gap-2">{(market.options ?? []).map((option) => <span key={option} className="rounded-full px-3 py-1.5 text-xs" style={{ background: colors.surfaceSunken }}>{option} · {market.pledgeCounts?.[option] ?? 0}</span>)}</div>{(marketPledges[market.id] ?? []).map((pledge) => <div key={pledge.id ?? pledge.betId ?? `${pledge.userId}-${pledge.selection}`} className="mt-2 flex items-center justify-between text-xs"><span>{pledge.userName ?? pledge.username ?? 'User'} · {pledge.selection}</span><strong>{pledge.amount ?? 0}</strong></div>)}</article>)}</div>}
        {busy && <p className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: colors.textTertiary }}><RefreshCw size={13} className="animate-spin"/> Updating match data…</p>}
        {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg p-3 text-xs" style={{ color: colors.away, background: colors.awayDim }}><AlertCircle size={14}/>{error}</p>}
        {notice && <p role="status" className="mt-4 flex items-start gap-2 rounded-lg p-3 text-xs" style={{ color: colors.primary, background: colors.primaryDim }}><CheckCircle2 size={14}/>{notice}</p>}
        {voters.length > 0 && tab === 'vote' && <div className="mt-5 border-t pt-4" style={{ borderColor: colors.border }}><h3 className="mb-2 text-xs font-bold">Votes ({voters.length})</h3>{voters.slice(0, 20).map((v, i) => <div key={String(v.userId ?? v.user_id ?? i)} className="flex justify-between py-1 text-xs"><span>{v.username ?? v.userName ?? 'Anonymous'}</span><span style={{ color: colors.textTertiary }}>{v.selection ?? '—'}</span></div>)}</div>}
      </div>
      {fundsMode && <form onSubmit={(e) => void submitFunds(e)} className="border-t p-4" style={{ borderColor: colors.border, background: colors.surfaceElevated }}><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">{fundsMode === 'topup' ? 'Top up balance' : 'Withdraw funds'}</h3><button type="button" onClick={() => setFundsMode(null)} aria-label="Close funds form"><X size={15}/></button></div><input required value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: colors.border, background: colors.surfaceSunken, color: colors.textPrimary }}/><input required value={phone} onChange={(e) => setPhone(e.target.value)} onFocus={() => { if (!phone) void props.getSavedPhone(fundsMode).then((saved) => { if (saved) setPhone(saved); }).catch(() => undefined); }} placeholder="Phone number" className="mb-3 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: colors.border, background: colors.surfaceSunken, color: colors.textPrimary }}/><div className="flex justify-end gap-2"><button type="button" onClick={() => setFundsMode(null)} className="rounded-lg px-3 py-2 text-xs">Cancel</button><button type="submit" disabled={busy} className="rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: colors.primary, color: '#fff' }}>{busy ? 'Processing…' : 'Confirm'}</button></div></form>}
      <footer className="border-t px-5 py-3" style={{ borderColor: colors.border }}><button type="button" onClick={props.onClose} className="w-full rounded-xl border py-2.5 text-xs font-bold" style={{ borderColor: colors.border }}>Close</button></footer>
    </section>
  </div>, document.body);
}

function DataList({ title, rows, empty, colors }: { title: string; rows: any[]; empty: string; colors: ReturnType<typeof useFanColors> }) {
  return <section><h3 className="mb-3 text-sm font-bold">{title} ({rows.length})</h3>{rows.length === 0 ? <p className="py-8 text-center text-sm" style={{ color: colors.textTertiary }}>{empty}</p> : rows.map((row, index) => <article key={String(row.id ?? row.betId ?? row.userId ?? index)} className="mb-2 rounded-xl border p-3" style={{ borderColor: colors.border, background: colors.surfaceSunken }}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{row.userName ?? row.username ?? row.user_name ?? 'User'}</span><strong className="text-xs">{row.amount ?? row.total ?? ''}</strong></div><p className="mt-1 text-[11px]" style={{ color: colors.textTertiary }}>{row.selection ?? row.status ?? row.description ?? ''}</p></article>)}</section>;
}

export default SwipeableVotePledgeModal;
