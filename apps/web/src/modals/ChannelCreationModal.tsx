import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createChannel } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { colors } from '@/theme';

export function ChannelCreationModal({ onClose }: { onClose: () => void }) {
  const { userId, username, authToken } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('2025/26');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [onClose]);

  async function handleCreate() {
    if (!name.trim()) { setError('Give your channel a name'); return; }
    if (!userId || !username || !authToken) { setError('Log in to create a channel'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createChannel({
        name: name.trim(), createdBy: userId, createdByUsername: username,
        season, members: [{ id: userId, username }], authToken,
      });
      if (result.success) onClose();
      else setError(result.message ?? 'Failed to create channel');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create channel');
    } finally { setSubmitting(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[950] flex items-end justify-center bg-black/60" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="create-channel-title"
        className="w-full max-w-xl rounded-t-3xl p-6" style={{ background: colors.surface }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-600" />
        <h2 id="create-channel-title" className="mb-4 text-base font-bold text-white">Create Channel</h2>
        <label htmlFor="channel-name" className="mb-1 block text-[11px]" style={{ color: colors.textMuted }}>Channel name</label>
        <input id="channel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday League Squad"
          className="mb-3 w-full rounded-xl border px-3 py-2.5 text-white outline-none" style={{ borderColor: colors.border, background: 'rgba(0,0,0,.3)' }} />
        <label htmlFor="channel-season" className="mb-1 block text-[11px]" style={{ color: colors.textMuted }}>Season</label>
        <input id="channel-season" value={season} onChange={(e) => setSeason(e.target.value)}
          className="mb-3 w-full rounded-xl border px-3 py-2.5 text-white outline-none" style={{ borderColor: colors.border, background: 'rgba(0,0,0,.3)' }} />
        {error && <p role="alert" className="mb-3 text-[11px] text-red-400">{error}</p>}
        <button type="button" disabled={submitting} onClick={() => void handleCreate()} className="w-full rounded-xl py-3 text-sm font-bold disabled:opacity-60" style={{ background: colors.green, color: '#000' }}>
          {submitting ? 'Creating…' : 'Create Channel'}
        </button>
      </section>
    </div>, document.body);
}
