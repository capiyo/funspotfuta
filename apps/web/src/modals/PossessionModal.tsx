import { useCallback, useEffect, useState } from 'react';
import {
  castPossessionVote,
  createPossessionPoke,
  fetchPossessionMarket,
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
  const [market, setMarket] = useState<PossessionMarket | null>(null);
  const [selection, setSelection] = useState<PossessionSide>('home');
  const [amount, setAmount] = useState('5');
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
      setMarket(await fetchPossessionMarket({ fixtureId, channelId, authToken }));
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
  const actionContext = { fixtureId, channelId: channelId ?? '', authToken };

  async function submitVote() {
    if (!isLoggedIn || !userId || !username || !channelId) {
      setError('Sign in to make a possession prediction');
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await castPossessionVote({ ...actionContext, userId, username, selection });
      if (!result.success) throw new Error(result.message || 'Possession vote was not accepted');
      setNotice(result.message || 'Possession prediction recorded');
      if (result.market) setMarket(result.market); else await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit possession prediction');
    } finally { setBusy(false); }
  }

  async function submitPoke() {
    const points = Number(amount);
    if (!isLoggedIn || !userId || !username || !channelId) {
      setError('Sign in to create a possession poke');
      return;
    }
    if (!Number.isSafeInteger(points) || points <= 0) {
      setError('Enter a positive whole-number point amount');
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

  const panel: React.CSSProperties = {
    width: 'min(460px, calc(100vw - 28px))', maxHeight: 'min(82vh, 720px)', overflowY: 'auto',
    background: colors.surface, color: colors.textPrimary, borderRadius: 22,
    border: `1px solid ${colors.border}`, boxShadow: '0 24px 80px rgba(0,0,0,.32)',
    padding: 20,
  };
  const muted = { color: colors.textSecondary };
  const control = {
    border: `1px solid ${colors.border}`, borderRadius: 14, background: colors.background,
    color: colors.textPrimary, padding: '11px 13px', font: 'inherit', minWidth: 0,
  } as const;
  const action = (active: boolean): React.CSSProperties => ({
    ...control, flex: 1, cursor: 'pointer', borderColor: active ? colors.primary : colors.border,
    background: active ? colors.primaryDim : colors.background,
    color: active ? colors.primary : colors.textPrimary, fontWeight: 700,
  });

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(0,0,0,.58)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="possession-title" style={panel}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: colors.primary, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Possession market</div>
            <h2 id="possession-title" style={{ margin: '4px 0 3px', fontSize: 20, lineHeight: 1.2 }}>Who controls the game?</h2>
            <div style={{ ...muted, fontSize: 12 }}>{fixture.homeTeam} vs {fixture.awayTeam}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close possession modal" style={{ ...control, border: 0, borderRadius: '50%', width: 36, height: 36, padding: 0, cursor: 'pointer' }}>×</button>
        </header>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, padding: 4, borderRadius: 14, background: colors.background }}>
          <button type="button" onClick={() => { setTab('vote'); setError(null); }} style={action(tab === 'vote')}>Predict</button>
          <button type="button" onClick={() => { setTab('poke'); setError(null); }} style={action(tab === 'poke')}>Poke</button>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <strong style={{ fontSize: 13 }}>Possession predictions</strong>
            <span style={{ ...muted, fontSize: 11 }}>{totalVotes} {totalVotes === 1 ? 'prediction' : 'predictions'}</span>
          </div>
          <div style={{ display: 'flex', height: 9, overflow: 'hidden', borderRadius: 20, background: colors.border, marginTop: 9 }}>
            <div style={{ width: `${homePercent}%`, background: colors.primary, transition: 'width .2s' }} />
            <div style={{ flex: 1, background: colors.away }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12 }}>
            <span>{fixture.homeTeam} <b>{homeVotes}</b> · {totalVotes ? homePercent : 0}%</span>
            <span>{fixture.awayTeam} <b>{awayVotes}</b> · {totalVotes ? 100 - homePercent : 0}%</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
          <button type="button" onClick={() => setSelection('home')} style={action(selection === 'home')}>{fixture.homeTeam}</button>
          <button type="button" onClick={() => setSelection('away')} style={action(selection === 'away')}>{fixture.awayTeam}</button>
        </div>

        {tab === 'vote' ? (
          <button type="button" disabled={busy || loading || market?.status === 'settled'} onClick={() => void submitVote()}
            style={{ ...action(true), width: '100%', marginTop: 12, padding: 13, opacity: busy ? .6 : 1 }}>
            {busy ? 'Submitting…' : 'Submit possession prediction'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <label style={{ flex: 1, minWidth: 0, fontSize: 11, ...muted }}>Points to stake
              <input type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} style={{ ...control, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5 }} />
            </label>
            <button type="button" disabled={busy || loading} onClick={() => void submitPoke()} style={{ ...action(true), alignSelf: 'end', padding: '12px 16px', opacity: busy ? .6 : 1 }}>Create poke</button>
          </div>
        )}

        {error && <p role="alert" style={{ color: colors.danger, fontSize: 12, margin: '12px 0 0' }}>{error}</p>}
        {notice && <p role="status" style={{ color: colors.primary, fontSize: 12, margin: '12px 0 0' }}>{notice}</p>}

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13 }}>Open possession pokes</strong>
            <button type="button" onClick={() => void refresh()} disabled={loading} style={{ background: 'transparent', border: 0, color: colors.primary, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
          </div>
          {loading && <p style={{ ...muted, fontSize: 12 }}>Loading possession market…</p>}
          {!loading && (market?.pokes.length ?? 0) === 0 && <p style={{ ...muted, fontSize: 12 }}>No open possession pokes yet.</p>}
          {(market?.pokes ?? []).filter((poke) => poke.status === 'open').map((poke) => (
            <div key={poke.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{poke.username}</div>
                <div style={{ ...muted, fontSize: 11 }}>{poke.selection === 'home' ? fixture.homeTeam : fixture.awayTeam} · {poke.amount} pts</div>
              </div>
              {poke.userId !== userId && <button type="button" disabled={busy} onClick={() => void matchPoke(poke.id)} style={{ ...control, padding: '7px 11px', color: colors.primary, fontWeight: 700, cursor: 'pointer' }}>Match</button>}
            </div>
          ))}
          {market?.settlement && <p style={{ ...muted, fontSize: 12 }}>Settled · winner: {market.settlement.winner ?? 'No winner'}</p>}
        </div>
        <p style={{ ...muted, fontSize: 10, lineHeight: 1.45, margin: '16px 0 0' }}>Possession predictions and pokes are separate from match-winner votes and regular match pokes.</p>
      </section>
    </div>
  );
}
