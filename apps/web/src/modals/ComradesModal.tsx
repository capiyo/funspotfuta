import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  getUserComrades,
  getComradeStats,
  addComrade,
  removeComrade,
  searchPotentialComrades,
  type ComradeStats,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { colors } from '@/theme';

export default function ComradesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { userId, username, authToken } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [comrades, setComrades] = useState<Record<string, any>[]>([]);
  const [stats, setStats] = useState<ComradeStats | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    if (!userId) return;
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        getUserComrades(userId, authToken ?? undefined),
        getComradeStats(userId, authToken ?? undefined),
      ]);
      setComrades(list);
      setStats(summary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

  async function handleSearch() {
    if (!userId || !query.trim()) {
      setResults([]);
      return;
    }
    setResults(await searchPotentialComrades(query.trim(), userId, authToken ?? undefined));
  }

  async function handleAdd(candidate: Record<string, any>) {
    if (!userId || !username || !authToken) return;
    const id = String(candidate.id ?? candidate._id ?? '');
    if (!id) return;
    setBusyId(id);
    try {
      await addComrade({
        userId,
        comradeId: id,
        username,
        comradeUsername: candidate.username ?? 'Unknown',
        comradeNickname: candidate.nickname ?? candidate.username ?? 'Unknown',
        comradeClub: candidate.club ?? '',
        comradeCountry: candidate.country ?? '',
        authToken,
      });
      setResults((previous) => previous.filter((item) => String(item.id ?? item._id) !== id));
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(comradeId: string) {
    if (!userId || !authToken) return;
    setBusyId(comradeId);
    try {
      await removeComrade(userId, comradeId, authToken);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!visible) return null;
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    padding: '10px 12px',
    marginBottom: 8,
  };
  const inputStyle: React.CSSProperties = {
    minWidth: 0,
    flex: 1,
    border: `1px solid ${colors.border}`,
    background: 'rgba(255,255,255,.05)',
    borderRadius: 999,
    padding: '10px 16px',
    color: 'white',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex items-end justify-center bg-black/50"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Comrades"
        className="w-full max-w-xl overflow-hidden rounded-t-[18px]"
        style={{ maxHeight: '85vh', background: colors.bg }}
      >
        <div className="flex justify-center pb-1 pt-2">
          <div className="h-[3px] w-8 rounded-full" style={{ background: 'rgba(255,255,255,.15)' }} />
        </div>
        <header className="flex items-center justify-between px-4 py-2">
          <h2 className="text-[15px] font-bold text-white">Comrades</h2>
          <button
            type="button"
            aria-label="Close comrades"
            onClick={onClose}
            className="rounded-full p-1.5"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            <X size={14} color={colors.textMuted} />
          </button>
        </header>

        <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(85vh - 58px)' }}>
          {stats && (
            <p className="mb-4 text-[11px]" style={{ color: colors.textMuted }}>
              {stats.count}/{stats.max_comrades} · {stats.remaining} remaining
            </p>
          )}

          <form
            className="mb-4 flex gap-2"
            onSubmit={(event) => { event.preventDefault(); void handleSearch(); }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by username…"
              aria-label="Search by username"
              style={inputStyle}
            />
            <button
              type="submit"
              className="rounded-full px-4 text-xs font-bold"
              style={{ background: colors.green, color: '#000' }}
            >
              Search
            </button>
          </form>

          {results.length > 0 && (
            <section className="mb-4">
              <h3 className="mb-2 text-[11px]" style={{ color: colors.textMuted }}>Results</h3>
              {results.map((candidate) => {
                const id = String(candidate.id ?? candidate._id ?? '');
                return (
                  <div key={id} style={rowStyle}>
                    <span className="text-[13px] text-white">{candidate.username}</span>
                    <button
                      type="button"
                      className="rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-60"
                      style={{ background: colors.green, color: '#000' }}
                      disabled={busyId === id}
                      onClick={() => void handleAdd(candidate)}
                    >
                      {busyId === id ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </section>
          )}

          <h3 className="mb-2 text-[11px]" style={{ color: colors.textMuted }}>Your comrades</h3>
          {loading ? (
            <p role="status" className="mt-5 text-center" style={{ color: colors.green }}>Loading…</p>
          ) : comrades.length === 0 ? (
            <p className="mt-5 text-center text-[13px]" style={{ color: colors.textMuted }}>
              No comrades yet — search above to add some.
            </p>
          ) : (
            comrades.map((comrade) => {
              const id = String(comrade.comrade_id ?? comrade.id ?? '');
              return (
                <div key={id} style={rowStyle}>
                  <div>
                    <p className="text-[13px] text-white">{comrade.comrade_username ?? comrade.username}</p>
                    {comrade.comrade_nickname && (
                      <p className="text-[11px]" style={{ color: colors.textMuted }}>{comrade.comrade_nickname}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busyId === id}
                    onClick={() => void handleRemove(id)}
                    className="rounded-full border px-3 py-1 text-[11px] font-bold disabled:opacity-60"
                    style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.1)', color: '#f87171' }}
                  >
                    {busyId === id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
