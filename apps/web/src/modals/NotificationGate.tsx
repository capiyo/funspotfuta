import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff } from 'lucide-react';
import { colors } from '@/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { NotificationService, requestWebPushToken } from '@/lib/api/notification-service';

export default function NotificationGate({ visible, onRetry }: { visible: boolean; onRetry: () => Promise<void> }) {
  const { userId, authToken } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)'));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [visible]);

  async function handlePress() {
    if (requesting) return;
    setRequesting(true);
    setMessage('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        setUnsupported(true);
        setMessage('Notifications are not supported in this browser. You can continue without them.');
        return;
      }
      if (Notification.permission === 'denied') {
        setMessage('Notifications are blocked in your browser settings. Enable them there, then try again.');
        return;
      }
      // Permission is requested only in direct response to this user click.
      const token = await requestWebPushToken();
      if (token && userId) {
        await NotificationService.registerToken({ userId, fcmToken: token, platform: 'web', authToken: authToken ?? undefined });
      } else if (Notification.permission !== 'granted') {
        setMessage('Permission was not granted. You can enable notifications in your browser settings.');
        return;
      } else {
        setMessage('Push notifications could not be initialized on this device. You can continue without them.');
        return;
      }
      await onRetry();
    } catch {
      setMessage('Notifications could not be enabled right now. You can continue without them.');
    } finally {
      setRequesting(false);
    }
  }

  if (!visible) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-6" role="presentation">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="notification-gate-title"
        className="w-full max-w-[340px] rounded-2xl border p-5 text-center shadow-2xl"
        style={{ borderColor: colors.border, background: colors.surface }}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(76,217,100,.12)' }}>
          {unsupported ? <BellOff size={28} color={colors.textMuted} /> : <Bell size={28} color={colors.green} />}
        </div>
        <h2 id="notification-gate-title" className="mb-2 text-base font-bold text-white">Notifications Required</h2>
        <p className="mb-4 text-center text-[13px] leading-[18px]" style={{ color: colors.textMuted }}>
          Funspot needs notification permission before you can log in, so you never miss votes, comments, or comrade activity.
        </p>
        {message && <p role="status" className="mb-4 text-sm" style={{ color: colors.textMuted }}>{message}</p>}
        <button type="button" onClick={handlePress} disabled={requesting}
          className="w-full rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-60"
          style={{ background: colors.green }}>
          {requesting ? 'Requesting…' : unsupported ? 'Try Notifications Again' : 'Allow Notifications'}
        </button>
      </section>
    </div>,
    document.body,
  );
}
