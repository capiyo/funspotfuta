import { useEffect, useMemo, useState } from 'react';
import { getOpenSubFixtureBets, getUserSubFixtureBets, fillSubFixtureBet } from '@funspot/core/src/api/sub-fixture-service';
import type { SubFixturePledge } from '@funspot/core/src/types/betting';
import type { CSSProperties } from 'react';
import type { Fixture } from '@funspot/core';
import { fetchBalance, fetchSubFixtures, fetchSubFixturePledges, fetchVoters, API_BASE_URL, type SubFixtureMarket } from '@funspot/core/src/api/vote-modal-shims';

type Props = {
  fixture: Fixture;
  userId: string;
  username: string;
  authToken?: string | null;
  onClose: () => void;
};

const backdropStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.58)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const panelStyle: CSSProperties = {
  width: 'min(100%, 480px)', maxHeight: 'min(88vh, 760px)', overflowY: 'auto',
  background: 'var(--surface, #17191d)', color: 'var(--text, #f7f7f7)',
  borderRadius: 14, padding: 20, boxShadow: '0 20px 70px rgba(0,0,0,.4)',
};
const buttonStyle: CSSProperties = {
  minHeight: 42, border: 0, borderRadius: 8, padding: '10px 14px',
  fontWeight: 700, cursor: 'pointer',
};
const fieldStyle: CSSProperties = {
  width: '100%', minHeight: 42, borderRadius: 8, padding: '9px 11px',
  border: '1px solid var(--border, #454950)', background: 'var(--background, #202329)',
  color: 'inherit', boxSizing: 'border-box',
};

function normalizedOption(option: string, fixture: Fixture): 'home_team' | 'away_team' | null {
  const value = option.trim().toLowerCase();
  if (value === 'home' || value === 'home_team' || value === fixture.homeTeam.toLowerCase()) return 'home_team';
  if (value === 'away' || value === 'away_team' || value === fixture.awayTeam.toLowerCase()) return 'away_team';
  return null;
}

export function PokeModal({ fixture, userId, username, authToken, onClose }: Props) {
  const [tab, setTab] = useState<'open' | 'matched' | 'subfixtures'>('open');
  const [openPokes, setOpenPokes] = useState<SubFixturePledge[]>([]);
  const [matchedPokes, setMatchedPokes] = useState<SubFixturePledge[]>([]);
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchBalance(userId, authToken),
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
  }, [authToken, fixture.id, fixture.matchId, userId]);

  useEffect(() => {
    let active = true;
    const matchId = fixture.matchId || fixture.id;
    Promise.all([getOpenSubFixtureBets(matchId, authToken || undefined), getUserSubFixtureBets(userId, authToken || undefined)])
      .then(([open, mine]) => {
        if (!active) return;
        setOpenPokes(open.filter((p) => p.status.toLowerCase() === 'open' && p.matchId === matchId));
        setMatchedPokes(mine.filter((p) => p.status.toLowerCase() !== 'open'));
      }).catch(() => {});
    return () => { active = false; };
  }, [fixture.id, fixture.matchId, userId, authToken]);

  const selectedMarket = useMemo(() => markets.find((market) => market.id === marketId), [marketId, markets]);
  const options = useMemo(() => {
    if (!selectedMarket) return [
      { value: 'home_team', label: fixture.homeTeam },
      { value: 'away_team', label: fixture.awayTeam },
    ];
    const parsed = selectedMarket.options.map((option) => ({
      value: normalizedOption(option, fixture), label: option,
    })).filter((option): option is { value: 'home_team' | 'away_team'; label: string } => option.value !== null);
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

  async function submitPoke() {
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
      // Reuses the existing sub-fixture bet endpoint. The backend can add
      // action="poke" / stake_type="points" handling without a new route.
      const response = await fetch(`${API_BASE_URL}/sub_fixtures/sub-fixture/bet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          match_id: fixture.matchId || fixture.id,
          market_id: selectedMarket?.id ?? 'main_fixture',
          starter_id: userId,
          starter_name: username,
          selection,
          amount,
          action: 'poke',
          stake_type: 'points',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || `Poke request failed (${response.status}).`);
      }
      setMessage('Poke was successful!');
      setBalance((current) => current === null ? null : current - amount);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit poke.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={backdropStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="poke-modal-title" style={panelStyle}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ color: 'var(--muted, #a7abb3)', fontSize: 12, marginBottom: 5 }}>POKE WITH POINTS</div>
            <h2 id="poke-modal-title" style={{ fontSize: 20, lineHeight: 1.3, margin: 0 }}>{fixture.homeTeam} vs {fixture.awayTeam}</h2>
          </div>
          <button type="button" aria-label="Close poke modal" onClick={onClose} disabled={submitting} style={{ ...buttonStyle, minHeight: 32, padding: '4px 10px', background: 'transparent', color: 'inherit', fontSize: 22 }}>×</button>
        </header>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 8, background: 'var(--background, #202329)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted, #a7abb3)' }}>Available points</div>
          <strong style={{ fontSize: 22 }}>{loading ? 'Loading…' : balance === null ? 'Unavailable' : balance.toLocaleString()}</strong>
        </div>

        {tab==='subfixtures' && <div><label style={{ display: 'block', marginTop: 16, fontSize: 13, fontWeight: 700 }} htmlFor="poke-market">Fixture / sub-fixture</label>
        <select id="poke-market" value={marketId} onChange={(event) => { setMarketId(event.target.value); setError(''); }} style={{ ...fieldStyle, marginTop: 7 }}>
          <option value="main_fixture">Main fixture</option>
          {markets.map((market) => <option key={market.id} value={market.id}>{market.marketType || 'Sub-fixture'}{market.line == null ? '' : ` (${market.line})`}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {options.map((option) => (
            <button key={option.value} type="button" onClick={() => setSelection(option.value as 'home_team' | 'away_team')} aria-pressed={selection === option.value}
              style={{ ...buttonStyle, border: selection === option.value ? '2px solid var(--primary, #36c875)' : '1px solid var(--border, #454950)', background: selection === option.value ? 'var(--primary-dim, rgba(54,200,117,.15))' : 'transparent', color: 'inherit' }}>
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

        {error && <p role="alert" style={{ color: '#ff7777', fontSize: 13 }}>{error}</p>}
        {message && <p role="status" style={{ color: 'var(--primary, #36c875)', fontWeight: 700 }}>{message}</p>}
        <footer style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ ...buttonStyle, flex: 1, color: 'inherit', background: 'transparent', border: '1px solid var(--border, #454950)' }}>Cancel</button>
          <button type="button" onClick={() => void submitPoke()} disabled={loading || submitting || balance === null || (selectedMarket !== undefined && options.length === 0)}
            style={{ ...buttonStyle, flex: 1, color: '#07170d', background: 'var(--primary, #36c875)', opacity: loading || submitting ? .65 : 1 }}>
            {submitting ? 'Poking…' : 'Poke'}
          </button>
        </footer>
        <p style={{ color: 'var(--muted, #a7abb3)', fontSize: 11, lineHeight: 1.45, marginBottom: 0 }}>
          Pokes send <code>action: "poke"</code> and <code>stake_type: "points"</code> to the existing endpoint. The backend must recognize these fields and apply points accounting.
        </p></div>}
      </section>
    </div>
  );
}
