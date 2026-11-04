import { Avatar } from '@/components/ui/Avatar';
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  castPossessionVote,
  createPossessionPoke,
  fetchPossessionMarket,
  fetchPossessionPokes,
  fetchPossessionVotes,
  matchPossessionPoke,
} from '@funspot/core';
import type { Fixture, PossessionMarket, PossessionSide } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

type Tab = 'vote' | 'poke';
type Props = {
  fixture: Fixture | null;
  channelId?: string;
  userId: string;
  username: string;
  authToken?: string | null;
  isLoggedIn: boolean;
  onClose: () => void;
};

export function PossessionModal({ fixture, channelId, userId, username, authToken, isLoggedIn, onClose }: Props) {
  const colors = useFanColors();
  const [tab, setTab] = useState<Tab>('vote');
  const [listTab, setListTab] = useState<'votes' | 'open' | 'matched'>('votes');
  const [market, setMarket] = useState<PossessionMarket | null>(null);
  const [selection, setSelection] = useState<PossessionSide>('home');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fixtureId = fixture?.matchId || fixture?.id || '';

  const refresh = useCallback(async () => {
    if (!fixtureId || !channelId) return;
    setLoading(true);
    setError(null);
    try {
      const context = { fixtureId, channelId, userId, authToken };
      const [nextMarket, votes, pokes] = await Promise.all([
        fetchPossessionMarket(context),
        fetchPossessionVotes(context),
        fetchPossessionPokes(context),
      ]);
      setMarket({ ...nextMarket, votes, pokes });
      setSelection(nextMarket.userSelection ?? 'home');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load possession market');
    } finally {
      setLoading(false);
    }
  }, [fixtureId, channelId, authToken]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!fixture) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fixture, onClose]);

  if (!fixture) return null;
  const homeVotes = market?.homeVotes ?? 0;
  const awayVotes = market?.awayVotes ?? 0;
  const totalVotes = homeVotes + awayVotes;
  const homePercent = totalVotes ? Math.round(homeVotes / totalVotes * 100) : 50;
  const actionContext = { fixtureId, channelId: channelId ?? '', userId, authToken };

  async function submitVote() {
    if (!isLoggedIn || !userId || !username || !channelId) {
      setError('Sign in to make a possession vote');
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await castPossessionVote({ ...actionContext, userId, username, selection });
      if (!result.success) throw new Error(result.message || 'Possession vote was not accepted');
      setNotice(result.message || 'Possession vote recorded');
      if (result.market) setMarket(result.market); else await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit possession vote');
    } finally { setBusy(false); }
  }

  async function submitPoke() {
    const points = Number(amount);
    if (!isLoggedIn || !userId || !username || !channelId) {
      setError('Sign in to create a possession poke');
      return;
    }
    if (!Number.isSafeInteger(points) || points < 5) {
      setError('Enter at least 5 whole-number points');
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await createPossessionPoke({ ...actionContext, userId, username, selection, amount: points });
      if (!result.success) throw new Error(result.message || 'Possession poke was not accepted');
      setNotice(result.message || 'Possession poke created');
      if (result.market) setMarket(result.market); else await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create possession poke');
    } finally { setBusy(false); }
  }

  async function matchPoke(pokeId: string) {
    if (!userId || !channelId) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await matchPossessionPoke({ ...actionContext, userId, pokeId });
      if (!result.success) throw new Error(result.message || 'Could not match possession poke');
      setNotice(result.message || 'Possession poke matched');
      if (result.market) setMarket(result.market); else await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not match possession poke');
    } finally { setBusy(false); }
  }

  const panel: CSSProperties = {
    width: '100vw', maxWidth: 448, height: '50dvh', maxHeight: '50dvh',
    display: 'flex', flexDirection: 'column', overflowY: 'auto',
    background: colors.surface, color: colors.textPrimary,
    borderRadius: '24px 24px 0 0', padding: '6px 12px 8px', boxSizing: 'border-box',
    boxShadow: '0 -12px 48px rgba(0,0,0,.25)',
  };
  const muted = { color: colors.textSecondary };
  const control = {
    border: `1px solid ${colors.border}`, borderRadius: 999, background: 'transparent',
    color: colors.textPrimary, padding: '11px 13px', font: 'inherit', minWidth: 0,
  } as const;
  const action = (active: boolean): CSSProperties => ({
    ...control, flex: 1, cursor: 'pointer', borderColor: active ? colors.primary : colors.border,
    background: 'transparent',
    color: active ? colors.primary : colors.textPrimary, fontWeight: 700,
  });

  return (
    <div className="possession-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0, background: 'rgba(0,0,0,.58)' }}>
      <section className="possession-modal-panel" role="dialog" aria-modal="true" aria-labelledby="possession-title" style={panel}>
        <div aria-hidden="true" style={{ width: 32, height: 4, borderRadius: 999, background: colors.border, margin: '0 auto 7px', flexShrink: 0 }} />
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <div aria-hidden="true" style={{ width: 36, height: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: colors.primaryDim, color: colors.primary, fontSize: 17 }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="possession-title" style={{ margin: 0, fontSize: 16, lineHeight: 1.3, fontWeight: 800 }}>Possession</h2>
            <div style={{ ...muted, fontSize: 11, marginTop: 3 }}>{fixture.league || 'Match'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close possession modal" style={{ ...control, border: 0, borderRadius: '50%', width: 32, height: 32, padding: 0, cursor: 'pointer', background: colors.surfaceSunken, fontSize: 20 }}>×</button>
        </header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 8px', marginBottom: 6, borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ flex: 1, minWidth: 0, color: colors.primary, fontSize: 13, fontWeight: 800 }}>{fixture.homeTeam}</div>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 4, color: colors.textTertiary, fontSize: 10, fontWeight: 800 }}>VS{(fixture.isLive || fixture.status === 'live') && <span style={{ color: colors.textInverse, background: colors.away, borderRadius: 99, padding: '2px 6px', fontSize: 8 }}>LIVE</span>}</div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right', color: colors.away, fontSize: 13, fontWeight: 800 }}>{fixture.awayTeam}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 3, marginBottom: 6, padding: 3, borderRadius: 999, background: 'transparent', border: `1px solid ${colors.border}` }}>
          <button type="button" onClick={() => { setTab('vote'); setError(null); }} style={action(tab === 'vote')}>Vote</button>
          <button type="button" onClick={() => { setTab('poke'); setError(null); }} style={action(tab === 'poke')}>Poke</button>
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
          <button type="button" onClick={() => setSelection('home')} style={action(selection === 'home')}>{fixture.homeTeam}</button>
          <button type="button" onClick={() => setSelection('away')} style={action(selection === 'away')}>{fixture.awayTeam}</button>
        </div>

        {tab === 'vote' ? (
          <button type="button" disabled={busy || loading || market !== null && market.status !== 'open'} onClick={() => void submitVote()}
            style={{ ...action(true), width: '100%', marginTop: 12, padding: 13, opacity: busy ? .6 : 1 }}>
            {busy ? 'Submitting…' : 'Submit possession vote'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <label style={{ flex: 1, minWidth: 0, fontSize: 11, ...muted }}>Points to stake
              <input type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} style={{ ...control, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5 }} />
            </label>
            <button type="button" disabled={busy || loading || (market !== null && market.status !== 'open')} onClick={() => void submitPoke()} style={{ ...action(true), alignSelf: 'end', padding: '12px 16px', opacity: busy ? .6 : 1 }}>Create poke</button>
          </div>
        )}

        {error && <p role="alert" style={{ color: colors.away, fontSize: 12, margin: '12px 0 0' }}>{error}</p>}
        {notice && <p role="status" style={{ color: colors.primary, fontSize: 12, margin: '12px 0 0' }}>{notice}</p>}

        <div style={{ marginTop: 14, minWidth: 0 }}>
          <div role="tablist" aria-label="Possession lists" style={{ display: 'flex', width: '100%', minWidth: 0, gap: 3, marginBottom: 9, padding: 3, borderRadius: 999, background: 'transparent', border: `1px solid ${colors.border}`, boxSizing: 'border-box' }}>
            {([{ id: 'votes', label: 'Vote List', count: totalVotes }, { id: 'open', label: 'Unmatched', count: (market?.pokes ?? []).filter((poke) => poke.status === 'open').length }, { id: 'matched', label: 'Matched', count: (market?.pokes ?? []).filter((poke) => poke.status === 'matched' || poke.status === 'settled').length }] as const).map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={listTab === item.id} onClick={() => setListTab(item.id)} style={{ ...action(listTab === item.id), minWidth: 0, minHeight: 36, padding: '7px 3px', border: 0, borderRadius: 7, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label} <span style={{ opacity: .8 }}>({item.count})</span>
              </button>
            ))}
          </div>
          {loading && <p style={{ ...muted, fontSize: 12 }}>Loading possession market…</p>}
          {!loading && listTab === 'votes' && (<>
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <strong style={{ fontSize: 13 }}>Possession votes</strong>
            <span style={{ ...muted, fontSize: 11 }}>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
          </div>
          <div style={{ display: 'flex', height: 9, overflow: 'hidden', borderRadius: 20, background: colors.border, marginTop: 9 }}>
            <div style={{ width: `${homePercent}%`, background: colors.primary, transition: 'width .2s' }} />
            <div style={{ flex: 1, background: colors.away }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12 }}>
            <span>{fixture.homeTeam} <b>{homeVotes}</b> · {totalVotes ? homePercent : 0}%</span>
            <span>{fixture.awayTeam} <b>{awayVotes}</b> · {totalVotes ? 100 - homePercent : 0}%</span>
          </div>
          <div style={{ marginTop: 10 }}>
            {(market?.votes ?? []).map((vote) => (
              <div key={vote.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${colors.border}` }}>
                <Avatar colors={colors} size="sm" userId={vote.userId} label={vote.username?.[0] ?? '?'} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 650 }}>{vote.username}</span>
                <span style={{ color: vote.selection === 'home' ? colors.primary : colors.away, fontSize: 11, fontWeight: 700 }}>{vote.selection === 'home' ? fixture.homeTeam : fixture.awayTeam}</span>
              </div>
            ))}
            {!loading && (market?.votes.length ?? 0) === 0 && <p style={{ ...muted, fontSize: 11 }}>No possession votes yet.</p>}
          </div>
        </div>
          </>)}
          {!loading && listTab !== 'votes' && (market?.pokes ?? []).filter((poke) => listTab === 'open' ? poke.status === 'open' : poke.status === 'matched' || poke.status === 'settled').length === 0 && <p style={{ ...muted, fontSize: 12 }}>{listTab === 'open' ? 'No unmatched possession pokes yet.' : 'No matched possession pokes yet.'}</p>}
          {listTab !== 'votes' && (market?.pokes ?? []).filter((poke) => listTab === 'open' ? poke.status === 'open' : poke.status === 'matched' || poke.status === 'settled').map((poke) => (
            <div key={poke.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar colors={colors} size="md" userId={poke.userId} label={poke.username?.[0] ?? '?'} /><div style={{ fontSize: 12, fontWeight: 700 }}>{poke.username}</div></div>
                <div style={{ ...muted, fontSize: 11 }}>{poke.selection === 'home' ? fixture.homeTeam : fixture.awayTeam} · {poke.amount} pts</div>
                {listTab === 'matched' && poke.finisherName && <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>↔ {poke.finisherName} · {poke.finisherSelection === 'home' ? fixture.homeTeam : fixture.awayTeam} · {poke.finisherAmount ?? poke.amount} pts</div>}
              </div>
              {listTab === 'open' && poke.userId !== userId && <button type="button" disabled={busy || (market !== null && market.status !== 'open')} onClick={() => void matchPoke(poke.id)} style={{ ...control, padding: '7px 11px', color: colors.primary, fontWeight: 700, cursor: 'pointer' }}>Match</button>}
            </div>
          ))}
          {listTab === 'matched' && market?.settlement && <p style={{ ...muted, fontSize: 12 }}>Settled · winner: {market.settlement.winner ?? 'No winner'}</p>}
        </div>
        <p style={{ ...muted, fontSize: 10, lineHeight: 1.45, margin: '16px 0 0' }}>Possession votes and pokes are separate from match-winner votes and regular match pokes.</p>
      </section>
    </div>
  );
}
