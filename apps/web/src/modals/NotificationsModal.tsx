'use client';

// New UI on top of notification-service.ts: real unread counts and real
// preference toggles (vote/like/comment alerts) against the live backend.
// Actual push delivery (FCM in the original app) is not wired here — see
// README's Web Push note; this page covers the data half of the feature.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import {
  fetchUnreadSummary,
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferences,
  UnreadSummary,
} from '@funspot/core';

const LABELS: Record<keyof NotificationPreferences, string> = {
  vote_alerts: 'Vote alerts',
  like_alerts: 'Like alerts',
  comment_alerts: 'Comment alerts',
};

export default function NotificationsPage() {
  const { userId, authToken } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState<UnreadSummary | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!userId) {
      setLoading(false);
      return () => { mounted = false; };
    }
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const [s, p] = await Promise.all([
          fetchUnreadSummary(userId, authToken ?? undefined),
          getNotificationPreferences(userId),
        ]);
        if (!mounted) return;
        setSummary(s);
        setPrefs(p);
      } catch (error) {
        console.error('Could not load notification settings', error);
        if (mounted) {
          setLoadError(true);
          toast.showError('Could not load notification settings. Please try again.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [userId, authToken]);

  async function toggle(key: keyof NotificationPreferences) {
    if (!prefs || !userId) return;
    if (saving) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    try {
      const ok = await updateNotificationPreferences(userId, next, authToken ?? undefined);
      if (!ok) {
        setPrefs(previous);
        toast.showError('Failed to save preference');
      }
    } catch (error) {
      console.error('Could not update notification preference', error);
      setPrefs(previous);
      toast.showError('Failed to save preference. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-10 text-center">
        <p className="mb-fan-md text-fan-body text-fan-textTertiary">Could not load notification settings.</p>
        <button onClick={() => window.location.reload()} className="underline text-fan-body text-fan-primary">Try again</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-10">
      <h1 className="mb-fan-lg font-condensed text-fan-headline text-fan-textPrimary">Notifications</h1>

      {summary && (
        <div className="mb-fan-xxl grid grid-cols-2 gap-fan-md">
          <div className="rounded-fan-lg border border-fan-border bg-fan-surface p-fan-base text-center">
            <p className="font-condensed text-fan-statValue text-fan-textPrimary">{summary.notifications}</p>
            <p className="text-[11px] text-fan-textTertiary">Unread notifications</p>
          </div>
          <div className="rounded-fan-lg border border-fan-border bg-fan-surface p-fan-base text-center">
            <p className="font-condensed text-fan-statValue text-fan-textPrimary">{summary.comments}</p>
            <p className="text-[11px] text-fan-textTertiary">Unread comments</p>
          </div>
        </div>
      )}

      {prefs && (
        <div className="overflow-hidden rounded-fan-xl border border-fan-border bg-fan-surface">
          {(Object.keys(LABELS) as (keyof NotificationPreferences)[]).map((key, i) => (
            <div
              key={key}
              className={`flex items-center justify-between px-fan-lg py-fan-base ${i > 0 ? 'border-t border-fan-border/50' : ''}`}
            >
              <span className="text-fan-body text-fan-textPrimary">{LABELS[key]}</span>
              <button
                onClick={() => toggle(key)}
                disabled={saving}
                className={`h-6 w-11 rounded-fan-pill transition ${prefs[key] ? 'bg-fan-primary' : 'bg-fan-surfaceSunken'}`}
              >
                <span
                  className={`block h-5 w-5 rounded-fan-pill bg-white transition-transform ${
                    prefs[key] ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
