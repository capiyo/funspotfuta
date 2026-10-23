import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Channel } from '@funspot/core';
import ProfileContent from './ProfileContent';

export interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  channels?: Channel[];
}

export default function ProfileModal({ visible, onClose, channels = [] }: ProfileModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const focusFirst = () => focusable()?.[0]?.focus();
    const frame = window.requestAnimationFrame(focusFirst);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = Array.from(focusable() ?? []);
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [visible, onClose]);

  if (!visible || typeof document === 'undefined') return null;
  return createPortal(
    <div className="profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Profile" className="profile-modal-shell">
        <ProfileContent variant="modal" onClose={onClose} channels={channels} />
      </div>
    </div>,
    document.body,
  );
}
