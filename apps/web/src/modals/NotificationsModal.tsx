import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { FAN_SPACING, FAN_RADIUS, getAllFixtures, type Fixture } from '@funspot/core';
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
  const [activity, setActivity] = useState<Array<{ fixtureId: string; title: string; preview: string; count: number; time: number }>>([]);
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
        const [counts, p, unread, fixtures] = await Promise.all([
          NotificationService.loadInitialBadgeCounts(),
          NotificationService.getNotificationPreferences(userId, authToken ?? undefined),
          NotificationService.getAllUnreadFixturesWithDetails(),
          getAllFixtures().catch((): Fixture[] => []),
        ]);
        const rows = Object.entries(unread).map(([fixtureId, details]) => {
          const fixture = fixtures.find((item) => String(item.matchId ?? item.id) === fixtureId);
          const latest = details.latest_notification ?? {};
          return {
            fixtureId,
            title: fixture ? `${fixture.homeTeam} vs ${fixture.awayTeam}` : 'Match conversation',
            preview: String(latest.message ?? latest.text ?? latest.type ?? 'New match activity').replace(/[._-]+/g, ' '),
            count: Number(details.notification_count ?? details.count ?? 0),
            time: Number(details.last_notification_time ?? 0),
          };
        }).sort((a, b) => b.time - a.time);
        setActivity(rows);
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
  }, [authToken, visible, userId]);

  useEffect(() => {
    if (!visible) return;
    const unsubscribe = NotificationService.onNotification(() => {
      void Promise.all([
        NotificationService.loadInitialBadgeCounts(),
        NotificationService.getAllUnreadFixturesWithDetails(),
      ]).then(([counts, unread]) => {
        setSummary({
          notifications: counts.unread_notifications,
          comments: counts.unread_comments,
        });
        setActivity((current) => {
          const byId = new Map(current.map((item) => [item.fixtureId, item]));
          return Object.entries(unread).map(([fixtureId, details]) => ({
            ...(byId.get(fixtureId) ?? { fixtureId, title: 'Match conversation', preview: 'New match activity' }),
            count: Number(details.notification_count ?? details.count ?? 0),
            time: Number(details.last_notification_time ?? 0),
          })).sort((a, b) => b.time - a.time);
        });
      });
    });
    return unsubscribe;
  }, [visible]);

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
    maxHeight: '80vh', marginBottom: 8, borderRadius: FAN_RADIUS.xl,
    background: colors.background, overflow: 'hidden', color: colors.textPrimary,
  };
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Notifications" className="mb-2 w-[calc(100%-16px)] max-w-xl overflow-hidden rounded-3xl" style={panel}>
        <div className="flex justify-center pb-2 pt-4"><div className="h-[3px] w-8 rounded-full" style={{ background: colors.border }} /></div>
        <header className="flex items-center justify-between px-5 py-3">
          <h2 className="text-[15px] font-bold">Notifications</h2>
          <button type="button" onClick={onClose} aria-label="Close notifications" className="rounded-full p-2" style={{ background: 'transparent' }}><X size={14} color={colors.textSecondary} /></button>
        </header>
        {loading ? <div className="py-10 text-center" role="status" style={{ color: colors.primary }}>Loading…</div> :
          <div className="no-scrollbar overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(80vh - 72px)' }}>
            {summary && <div className="mb-4 flex gap-3">
              {[{ label: 'Unread notifications', value: summary.notifications }, { label: 'Unread comments', value: summary.comments }].map((item) =>
                <div key={item.label} className="flex flex-1 flex-col items-center rounded-2xl p-3" style={{ gap: FAN_SPACING.xs }}>
                  <strong className="text-xl font-extrabold">{item.value}</strong><span className="text-[10px]" style={{ color: colors.textTertiary }}>{item.label}</span>
                </div>)}
            </div>}
            {activity.length > 0 && <section className="mb-5">
              <h3 className="mb-2 text-[13px] font-extrabold">Recent activity</h3>
              <div className="space-y-1">
                {activity.map((item) => <button
                  key={item.fixtureId}
                  type="button"
                  onClick={() => {
                    void NotificationService.clearUnreadForFixture(item.fixtureId).then(async () => {
                      const counts = await NotificationService.loadInitialBadgeCounts();
                      setSummary({ notifications: counts.unread_notifications, comments: counts.unread_comments });
                    });
                    setActivity((current) => current.filter((row) => row.fixtureId !== item.fixtureId));
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors"
                  style={{ background: 'transparent' }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: colors.primaryDim }}>⚽</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[13px]">{item.title}</strong>
                    <span className="mt-1 block truncate text-[11px]" style={{ color: colors.textTertiary }}>{item.preview}</span>
                  </span>
                  {item.count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold" style={{ background: colors.primary, color: colors.textInverse }}>{item.count > 99 ? '99+' : item.count}</span>}
                </button>)}
              </div>
            </section>}
            {prefs && <div className="overflow-hidden rounded-2xl">
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
