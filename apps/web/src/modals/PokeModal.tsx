import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPoke, getOpenPokes, getUserPokes, getUserPoints, matchPoke, type Poke } from '@funspot/core';
import type { CSSProperties, TouchEvent as ReactTouchEvent } from 'react';
import type { Channel, Fixture, FanColorPalette } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { queryKeys } from '@funspot/core';
import { fetchSubFixtures, fetchSubFixturePledges, fetchVoters, API_BASE_URL, type SubFixtureMarket } from '@funspot/core';

type Props = {
  fixture: Fixture;
  userId: string;
  username: string;
  authToken?: string | null;
  channelId?: string;
  onClose: () => void;
};

const backdropStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0,
};
const panelStyle = (colors: FanColorPalette): CSSProperties => ({
  width: '100%', maxWidth: 448, height: '50dvh', maxHeight: '50dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  background: colors.surface, color: colors.textPrimary,
  borderRadius: '16px 16px 0 0', padding: '6px 12px 8px', boxSizing: 'border-box',
  boxShadow: '0 -12px 48px rgba(0,0,0,.25)',
  '--surface': colors.surface, '--text': colors.textPrimary, '--primary': colors.primary,
  '--primary-dim': colors.primaryDim, '--muted': colors.textTertiary,
  '--border': colors.border, '--background': colors.surfaceSunken, '--away': colors.away,
  '--surface-sunken': colors.surfaceSunken, '--text-secondary': colors.textSecondary, '--text-inverse': colors.textInverse,
} as CSSProperties);
const buttonStyle: CSSProperties = {
  minHeight: 42, border: 0, borderRadius: 8, padding: '10px 14px',
  fontWeight: 700, cursor: 'pointer',
};
const fieldStyle: CSSProperties = {
  width: '100%', minHeight: 42, borderRadius: 8, padding: '9px 11px',
  border: '1px solid var(--border)', background: 'var(--background)',
  color: 'inherit', boxSizing: 'border-box',
};

function normalizedOption(option: string, fixture: Fixture): 'home_team' | 'away_team' | null {
  const value = option.trim().toLowerCase();
  if (value === 'home' || value === 'home_team' || value === fixture.homeTeam.toLowerCase()) return 'home_team';
  if (value === 'away' || value === 'away_team' || value === fixture.awayTeam.toLowerCase()) return 'away_team';
  return null;
}

function cachedChannelMemberPoints(channels: Channel[] | undefined, channelId: string | undefined, userId: string): number | null {
  const member = channels?.find((channel) => channel.channelId === channelId)?.members.find((item) => item.userId === userId);
  return typeof member?.seasonPoints === 'number' && Number.isFinite(member.seasonPoints) ? member.seasonPoints : null;
}

function writeCachedChannelMemberPoints(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  channelId: string | undefined,
  points: number,
): void {
  if (!channelId) return;
  queryClient.setQueryData<Channel[]>(queryKeys.channels(userId), (channels) => channels?.map((channel) => (
    channel.channelId !== channelId ? channel : {
      ...channel,
      members: channel.members.map((member) => member.userId === userId ? { ...member, seasonPoints: points } : member),
    }
  )));
}

export function PokeModal({ fixture, userId, username, authToken, channelId, onClose }: Props) {
  const colors = useFanColors();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'open' | 'matched' | 'subfixtures'>('open');
  const [openPokes, setOpenPokes] = useState<Poke[]>([]);
  const [matchedPokes, setMatchedPokes] = useState<Poke[]>([]);
  const [markets, setMarkets] = useState<SubFixtureMarket[]>([]);
  const [marketId, setMarketId] = useState('main_fixture');
  const [selection, setSelection] = useState<'home_team' | 'away_team'>('home_team');
  const [stake, setStake] = useState('5');
  const [balance, setBalance] = useState<number | null>(null);
  const [pokers, setPokers] = useState<Array<{ userName?: string; user_name?: string; starter_name?: string; selection?: string; amount?: number; starter_amount?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const tabOrder = ['open', 'matched', 'subfixtures'] as const;
  function onTouchStart(event: ReactTouchEvent<HTMLElement>) { const touch = event.touches[0]; touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }
  function onTouchEnd(event: ReactTouchEvent<HTMLElement>) { const start = touchStart.current; touchStart.current = null; const touch = event.changedTouches[0]; if (!start || !touch) return; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.25) return; setTab((current) => { const index = tabOrder.indexOf(current); return tabOrder[Math.max(0, Math.min(tabOrder.length - 1, index + (dx < 0 ? 1 : -1)))]; }); }

  useEffect(() => {
    let active = true;
    setLoading(true);
    const cachedPoints = cachedChannelMemberPoints(queryClient.getQueryData<Channel[]>(queryKeys.channels(userId)), channelId, userId);
    if (cachedPoints !== null) setBalance(cachedPoints);
    Promise.all([
      cachedPoints !== null ? Promise.resolve(cachedPoints) : getUserPoints(userId, authToken ?? undefined),
      fetchSubFixtures(fixture.matchId || fixture.id, authToken),
    ]).then(([points, availableMarkets]) => {
      if (!active) return;
      setBalance(points);
      setMarkets(availableMarkets.filter((market) => market.isVisible && market.status.toLowerCase() !== 'closed' && market.status.toLowerCase() !== 'settled'));
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load points and sub-fixtures.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [authToken, fixture.id, fixture.matchId, userId, channelId, queryClient]);

  useEffect(() => {
    let active = true;
    const matchId = fixture.matchId || fixture.id;
    Promise.all([getOpenPokes(matchId, authToken || undefined, channelId, marketId), getUserPokes(userId, authToken || undefined)])
      .then(([open, mine]) => {
        if (!active) return;
        setOpenPokes(open.filter((p) => p.status.toLowerCase() === 'open' && p.matchId === matchId));
        setMatchedPokes(mine.filter((p) => p.status.toLowerCase() !== 'open'));
      }).catch(() => {});
    return () => { active = false; };
  }, [fixture.id, fixture.matchId, userId, authToken, channelId, marketId]);

  const selectedMarket = useMemo(() => markets.find((market) => market.id === marketId), [marketId, markets]);
  const options = useMemo(() => {
    if (!selectedMarket) return [
      { value: 'home_team', label: fixture.homeTeam },
      { value: 'away_team', label: fixture.awayTeam },
    ];
    const parsed = selectedMarket.options.map((option) => {
      const value = normalizedOption(option, fixture);
      return value === null ? null : {
        value,
        label: value === 'home_team' ? fixture.homeTeam : fixture.awayTeam,
      };
    }).filter((option): option is { value: 'home_team' | 'away_team'; label: string } => option !== null);
    return parsed;
  }, [fixture, selectedMarket]);

  useEffect(() => {
    if (options.length && !options.some((option) => option.value === selection)) setSelection(options[0].value as 'home_team' | 'away_team');
  }, [options, selection]);

  useEffect(() => {
    let active = true;
    const fixtureId = fixture.matchId || fixture.id;
    const request = marketId === 'main_fixture'
      ? fetchVoters(fixtureId, authToken)
      : fetchSubFixturePledges(marketId, fixtureId, authToken);
    request.then((rows) => {
      if (active) setPokers(rows as Array<{ userName?: string; user_name?: string; starter_name?: string; selection?: string; amount?: number; starter_amount?: number }>);
    }).catch(() => {
      if (active) setPokers([]);
    });
    return () => { active = false; };
  }, [authToken, fixture.id, fixture.matchId, marketId]);

  async function matchExistingPoke(poke: Poke) {
    if (poke.userId === userId || submitting) return;
    if (!channelId) { setError('Choose a channel before matching a poke.'); return; }
    if (balance === null || balance < poke.amount) { setError('You do not have enough points to match this poke.'); return; }
    if (fixture.isLive || fixture.status === 'live') { setError('Pokes are closed once a match goes live.'); return; }
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await matchPoke({
        pokeId: poke.id,
        userId,
        userName: username,
        selection: poke.selection === 'home' ? 'away' : 'home',
        token: authToken ?? undefined,
      });
      const matchId = fixture.matchId || fixture.id;
      const [open, mine] = await Promise.all([
        getOpenPokes(matchId, authToken ?? undefined, channelId, marketId),
        getUserPokes(userId, authToken ?? undefined),
      ]);
      const nextBalance = balance === null ? null : Math.max(0, balance - poke.amount);
      setBalance(nextBalance);
      if (nextBalance !== null) writeCachedChannelMemberPoints(queryClient, userId, channelId, nextBalance);
      setOpenPokes(open.filter((item) => item.status.toLowerCase() === 'open' && item.matchId === matchId));
      setMatchedPokes(mine.filter((item) => item.status.toLowerCase() !== 'open'));
      setMessage('Poke matched successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not match poke.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPoke() {
    if (!channelId) { setError('Choose a channel before creating or matching a poke.'); return; }
    if (fixture.isLive || fixture.status === 'live') { setError('Pokes are closed once a match goes live.'); return; }
    setError('');
    setMessage('');
    const amount = Number(stake);
    if (!Number.isInteger(amount) || amount < 5) {
      setError('The minimum poke is 5 points.');
      return;
    }
    if (balance === null) {
      setError('Your points balance is not available yet.');
      return;
    }
    if (amount > balance) {
      setError('You do not have enough points for this poke.');
      return;
    }
    if (!options.some((option) => option.value === selection)) {
      setError('Choose a Home or Away outcome for this market.');
      return;
    }

    setSubmitting(true);
    try {
      await createPoke({
        matchId: fixture.matchId || fixture.id,
        userId,
        userName: username,
        selection: selection === 'home_team' ? 'home' : 'away',
        amount,
        token: authToken ?? undefined,
        marketId: selectedMarket?.id ?? 'main_fixture',
        channelId,
      });
      const matchId = fixture.matchId || fixture.id;
      const [open, mine] = await Promise.all([
        getOpenPokes(matchId, authToken ?? undefined, channelId, marketId),
        getUserPokes(userId, authToken ?? undefined),
      ]);
      const nextBalance = balance === null ? null : Math.max(0, balance - amount);
      setBalance(nextBalance);
      if (nextBalance !== null) writeCachedChannelMemberPoints(queryClient, userId, channelId, nextBalance);
      setOpenPokes(open.filter((poke) => poke.status.toLowerCase() === 'open' && poke.matchId === matchId));
      setMatchedPokes(mine.filter((poke) => poke.status.toLowerCase() !== 'open'));
      setMessage('Poke was successful!');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit poke.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="poke-modal-backdrop" style={backdropStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <section className="poke-modal-panel" role="dialog" aria-modal="true" aria-labelledby="poke-modal-title" style={panelStyle(colors)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div aria-hidden="true" style={{ width: 32, height: 4, borderRadius: 999, background: 'var(--border)', margin: '0 auto 7px' }} />
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div aria-hidden="true" style={{ width: 36, height: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--primary-dim)', color: 'var(--primary)', fontSize: 17 }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="poke-modal-title" style={{ fontSize: 16, lineHeight: 1.3, margin: 0, fontWeight: 800 }}>Poke</h2>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 3 }}>{fixture.league || 'Match'}</div>
          </div>
          <button type="button" aria-label="Close poke modal" onClick={onClose} disabled={submitting} style={{ ...buttonStyle, minHeight: 32, padding: '4px 10px', background: 'var(--surface-sunken)', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </header>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, padding: '8px 0 12px', marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
          <button type="button" onClick={() => { setMarketId('main_fixture'); setSelection('home_team'); setTab('subfixtures'); setError(''); setMessage(''); }} aria-label={`Poke on ${fixture.homeTeam}`} aria-pressed={tab === 'subfixtures' && marketId === 'main_fixture' && selection === 'home_team'} style={{ flex: 1, minWidth: 0, minHeight: 46, borderRadius: 8, padding: '8px 6px', border: tab === 'subfixtures' && marketId === 'main_fixture' && selection === 'home_team' ? '2px solid var(--primary)' : '1px solid var(--border)', background: tab === 'subfixtures' && marketId === 'main_fixture' && selection === 'home_team' ? 'var(--primary-dim)' : 'var(--surface-sunken)', color: 'var(--primary)', fontSize: 12, fontWeight: 800, overflowWrap: 'anywhere', cursor: 'pointer' }}>{fixture.homeTeam}</button>
          <div style={{ flex: '0 0 auto', display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 10, fontWeight: 800 }}>VS{(fixture.isLive || fixture.status === 'live') && <span style={{ color: 'var(--text-inverse)', background: 'var(--away)', borderRadius: 99, padding: '2px 6px', fontSize: 8 }}>LIVE</span>}</div>
          <button type="button" onClick={() => { setMarketId('main_fixture'); setSelection('away_team'); setTab('subfixtures'); setError(''); setMessage(''); }} aria-label={`Poke on ${fixture.awayTeam}`} aria-pressed={tab === 'subfixtures' && marketId === 'main_fixture' && selection === 'away_team'} style={{ flex: 1, minWidth: 0, minHeight: 46, borderRadius: 8, padding: '8px 6px', border: tab === 'subfixtures' && marketId === 'main_fixture' && selection === 'away_team' ? '2px solid var(--primary)' : '1px solid var(--border)', background: tab === 'subfixtures' && marketId === 'main_fixture' && selection === 'away_team' ? 'var(--primary-dim)' : 'var(--surface-sunken)', color: 'var(--away)', fontSize: 12, fontWeight: 800, textAlign: 'right', overflowWrap: 'anywhere', cursor: 'pointer' }}>{fixture.awayTeam}</button>
        </div>

        <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'var(--primary-dim)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Your points</div><strong style={{ fontSize: 17 }}>{loading ? 'Loading…' : balance === null ? 'Unavailable' : `${balance.toLocaleString()} pts`}</strong></div><span style={{ color: 'var(--primary)', fontSize: 10, fontWeight: 800 }}>MIN 5 PTS</span></div>
        </div>

        <div role="tablist" aria-label="Poke views" style={{ display: 'flex', flexShrink: 0, gap: 3, marginTop: 3, marginBottom: 6, padding: 3, borderRadius: 9, background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}>
          {([{ id: 'open', label: 'Open Pokes' }, { id: 'matched', label: 'Matched Pokes' }, { id: 'subfixtures', label: 'Sub-fixtures' }] as const).map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
              style={{ ...buttonStyle, flex: 1, minHeight: 31, padding: '5px 4px', fontSize: 10, color: tab === item.id ? 'var(--text)' : 'var(--muted)', background: tab === item.id ? 'var(--surface)' : 'transparent', border: '1px solid transparent', boxShadow: tab === item.id ? '0 1px 2px rgba(0,0,0,.10)' : 'none' }}>
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: 8 }}>
        {tab === 'open' && <section style={{ marginTop: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Open pokes · {openPokes.length}</h3>
          {openPokes.length === 0 ? <p style={{ margin: 0, color: 'var(--muted, #a7abb3)', fontSize: 12 }}>No open pokes for this fixture yet.</p> : openPokes.map((poke) => (
            <div key={poke.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}><strong>{poke.userName}</strong><div style={{ color: 'var(--muted, #a7abb3)', fontSize: 12 }}>{poke.selection === 'home' ? fixture.homeTeam : fixture.awayTeam} · {poke.amount} pts</div></div>
              <button type="button" disabled={poke.userId === userId || submitting || fixture.isLive || fixture.status === 'live'} onClick={() => void matchExistingPoke(poke)} style={{ ...buttonStyle, minHeight: 34, padding: '6px 10px', background: 'var(--primary)', color: 'var(--text-inverse)', opacity: poke.userId === userId || submitting || fixture.isLive || fixture.status === 'live' ? .5 : 1 }}>Match</button>
            </div>
          ))}
        </section>}
        {tab === 'matched' && <section style={{ marginTop: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Matched pokes · {matchedPokes.length}</h3>
          {matchedPokes.length === 0 ? <p style={{ margin: 0, color: 'var(--muted, #a7abb3)', fontSize: 12 }}>No matched pokes yet.</p> : matchedPokes.map((poke) => (
            <div key={poke.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--border, #35383e)' }}>
              <strong>{poke.userName}</strong><div style={{ color: 'var(--muted, #a7abb3)', fontSize: 12 }}>{poke.selection === 'home' ? fixture.homeTeam : fixture.awayTeam} · {poke.amount} pts · {poke.status}</div>
            </div>
          ))}
        </section>}
        {tab === 'subfixtures' && <div><label style={{ display: 'block', marginTop: 16, fontSize: 13, fontWeight: 700 }} htmlFor="poke-market">Fixture / sub-fixture</label>
        <select id="poke-market" value={marketId} onChange={(event) => { setMarketId(event.target.value); setError(''); }} style={{ ...fieldStyle, marginTop: 7 }}>
          <option value="main_fixture">Main fixture</option>
          {markets.map((market) => <option key={market.id} value={market.id}>{market.marketType || 'Sub-fixture'}{market.line == null ? '' : ` (${market.line})`}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {options.map((option) => (
            <button key={option.value} type="button" onClick={() => { setSelection(option.value as 'home_team' | 'away_team'); setError(''); setMessage(''); }} aria-label={`Select ${option.label}`} aria-pressed={selection === option.value}
              style={{ ...buttonStyle, border: selection === option.value ? '2px solid var(--primary)' : '1px solid var(--border)', background: selection === option.value ? 'var(--primary-dim)' : 'transparent', color: 'inherit' }}>
              {option.label}
            </button>
          ))}
        </div>
        {selectedMarket && options.length === 0 && <p style={{ color: 'var(--muted, #a7abb3)', fontSize: 13 }}>This sub-fixture has no Home/Away options, so it cannot be poked.</p>}

        <section aria-label="Pokers" style={{ marginTop: 18 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Pokers ({pokers.length})</h3>
          {pokers.length === 0
            ? <p style={{ margin: 0, color: 'var(--muted, #a7abb3)', fontSize: 12 }}>No pokes listed yet.</p>
            : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                {pokers.map((poker, index) => <li key={String(poker.userName ?? poker.user_name ?? poker.starter_name ?? index) + '-' + index} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '7px 0', borderBottom: '1px solid var(--border, #35383e)' }}>
                  <span>{poker.userName ?? poker.user_name ?? poker.starter_name ?? 'Fan'} · {poker.selection === 'home_team' ? fixture.homeTeam : poker.selection === 'away_team' ? fixture.awayTeam : poker.selection ?? '—'}</span>
                  <strong>{poker.amount ?? poker.starter_amount ?? 0} pts</strong>
                </li>)}
              </ul>}
        </section>

        <label style={{ display: 'block', marginTop: 16, fontSize: 13, fontWeight: 700 }} htmlFor="poke-stake">Points to stake (minimum 5)</label>
        <input id="poke-stake" type="number" min={5} step={1} value={stake} onChange={(event) => setStake(event.target.value)} style={{ ...fieldStyle, marginTop: 7 }} />

        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--background)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}><span style={{ color: 'var(--muted, #a7abb3)' }}>Your pick</span><strong>{selection === 'home_team' ? fixture.homeTeam : fixture.awayTeam}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 7, fontSize: 12 }}><span style={{ color: 'var(--muted, #a7abb3)' }}>Opponent stake</span><strong>{Number.isInteger(Number(stake)) && Number(stake) >= 5 ? `${Number(stake)} points to match` : '—'}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border, #454950)', fontSize: 12 }}><span style={{ color: 'var(--muted, #a7abb3)' }}>If you win</span><strong style={{ color: 'var(--primary, #36c875)' }}>{balance !== null && Number.isInteger(Number(stake)) && Number(stake) >= 5 && Number(stake) <= balance ? `${balance + Number(stake)} pts balance` : '—'}</strong></div>
        </div>
        {error && <p role="alert" style={{ color: 'var(--away)', fontSize: 13 }}>{error}</p>}
        {message && <p role="status" style={{ color: 'var(--primary, #36c875)', fontWeight: 700 }}>{message}</p>}
        <footer style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ ...buttonStyle, flex: 1, color: 'inherit', background: 'transparent', border: '1px solid var(--border, #454950)' }}>Cancel</button>
          <button type="button" onClick={() => void submitPoke()} disabled={loading || submitting || balance === null || fixture.isLive || fixture.status === 'live' || (selectedMarket !== undefined && options.length === 0)}
            style={{ ...buttonStyle, flex: 1, color: 'var(--text-inverse)', background: 'var(--primary)', opacity: loading || submitting || fixture.isLive || fixture.status === 'live' ? .65 : 1 }}>
            {submitting ? 'Poking…' : 'Poke'}
          </button>
        </footer>
        </div>}
        </div>
      </section>
    </div>
  );
}
