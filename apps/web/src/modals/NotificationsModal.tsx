import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { NotificationService } from '@/lib/api/notification-service';

type FanColors = ReturnType<typeof useFanColors>;
interface NotificationPreferences { vote_alerts: boolean; like_alerts: boolean; comment_alerts: boolean }
interface UnreadSummary { notifications: number; comments: number }
const LABELS: Record<keyof NotificationPreferences, string> = {
  vote_alerts: 'Vote alerts', like_alerts: 'Like alerts', comment_alerts: 'Comment alerts',
};

export default function NotificationsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useFanColors();
  const { userId, authToken } = useAuth();
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<UnreadSummary | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href]'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [counts, p] = await Promise.all([
          NotificationService.loadInitialBadgeCounts(),
          NotificationService.getNotificationPreferences(userId),
        ]);
        if (cancelled) return;
        setSummary({ notifications: counts.unread_notifications, comments: counts.unread_comments });
        setPrefs(p);
      } catch {
        if (!cancelled) setSummary({ notifications: 0, comments: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, userId]);

  async function toggle(key: keyof NotificationPreferences) {
    if (!prefs || !userId || saving) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    try {
      const ok = await NotificationService.updateNotificationPreferences({
        userId, voteAlerts: next.vote_alerts, likeAlerts: next.like_alerts,
        commentAlerts: next.comment_alerts, authToken: authToken ?? undefined,
      });
      if (!ok) { setPrefs(previous); toast.showError('Failed to save preference'); }
    } catch {
      setPrefs(previous); toast.showError('Failed to save preference');
    } finally { setSaving(false); }
  }

  if (!visible) return null;
  const panel: React.CSSProperties = {
    maxHeight: '80vh', borderTopLeftRadius: FAN_RADIUS.xl, borderTopRightRadius: FAN_RADIUS.xl,
    background: colors.background, overflow: 'hidden', color: colors.textPrimary,
  };
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Notifications" className="w-full max-w-xl overflow-hidden" style={panel}>
        <div className="flex justify-center pb-2 pt-4"><div className="h-[3px] w-8 rounded-full" style={{ background: colors.border }} /></div>
        <header className="flex items-center justify-between px-5 py-3">
          <h2 className="text-[15px] font-bold">Notifications</h2>
          <button type="button" onClick={onClose} aria-label="Close notifications" className="rounded-full p-2" style={{ background: colors.surfaceSunken }}><X size={14} color={colors.textSecondary} /></button>
        </header>
        {loading ? <div className="py-10 text-center" role="status" style={{ color: colors.primary }}>Loading…</div> :
          <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(80vh - 72px)' }}>
            {summary && <div className="mb-4 flex gap-3">
              {[{ label: 'Unread notifications', value: summary.notifications }, { label: 'Unread comments', value: summary.comments }].map((item) =>
                <div key={item.label} className="flex flex-1 flex-col items-center rounded-xl border p-3" style={{ borderColor: colors.border, background: colors.surface, gap: FAN_SPACING.xs }}>
                  <strong className="text-xl font-extrabold">{item.value}</strong><span className="text-[10px]" style={{ color: colors.textTertiary }}>{item.label}</span>
                </div>)}
            </div>}
            {prefs && <div className="overflow-hidden rounded-xl border" style={{ borderColor: colors.border, background: colors.surface }}>
              {(Object.keys(LABELS) as (keyof NotificationPreferences)[]).map((key, i) =>
                <div key={key} className="flex items-center justify-between px-4 py-3.5" style={{ borderTop: i ? `1px solid ${colors.border}` : undefined }}>
                  <span className="text-[13px]">{LABELS[key]}</span>
                  <button type="button" role="switch" aria-checked={prefs[key]} aria-label={LABELS[key]} disabled={saving} onClick={() => void toggle(key)}
                    className="relative h-6 w-11 rounded-full p-0.5 disabled:opacity-60" style={{ background: prefs[key] ? colors.primary : colors.surfaceSunken }}>
                    <span className="block h-5 w-5 rounded-full bg-white transition-transform" style={{ transform: prefs[key] ? 'translateX(20px)' : 'translateX(0)' }} />
                  </button>
                </div>)}
            </div>}
          </div>}
      </section>
    </div>, document.body);
}
