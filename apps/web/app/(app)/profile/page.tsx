'use client';

// Corresponds to the "Profile" tab. Session display + logout are wired
// against the ported AuthProvider; wallet is real (payment-service.ts);
// comrades/leaderboard/history now have real pages, linked below since
// they aren't on the 5-item bottom nav (matching the original app, which
// reaches them via in-page buttons rather than tabs).

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Trophy, History, Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { WalletCard } from '@/components/WalletCard';

const LINKS = [
  { href: '/comrades', label: 'Comrades', Icon: Users },
  { href: '/leaderboard', label: 'Leaderboard', Icon: Trophy },
  { href: '/history', label: 'Match History', Icon: History },
  { href: '/notifications', label: 'Notifications', Icon: Bell },
] as const;

export default function ProfilePage() {
  const { username, phone, userId, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="mx-auto max-w-md px-fan-xxl pt-10">
      <div className="mb-fan-xxl flex flex-col items-center">
        <div className="mb-fan-base flex h-20 w-20 items-center justify-center rounded-fan-pill bg-fan-primary/20 text-2xl font-bold text-fan-primary">
          {(username ?? '?').charAt(0).toUpperCase()}
        </div>
        <h1 className="font-condensed text-fan-headline text-fan-textPrimary">{username}</h1>
        {phone && <p className="text-fan-body text-fan-textTertiary">{phone}</p>}
        <p className="mt-fan-sm text-fan-caption text-fan-textTertiary">ID: {userId}</p>
      </div>

      <div className="mb-fan-xxl overflow-hidden rounded-fan-xl border border-fan-border bg-fan-surface">
        {LINKS.map(({ href, label, Icon }, i) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-fan-base px-fan-lg py-fan-base text-fan-body text-fan-textPrimary ${
              i > 0 ? '' : ''
            }`}
          >
            <Icon size={18} className="text-fan-primary" />
            <span className="flex-1">{label}</span>
            <ChevronRight size={16} className="text-fan-textTertiary" />
          </Link>
        ))}
      </div>

      <WalletCard />

      <button
        onClick={handleLogout}
        className="w-full rounded-fan-lg border border-fan-away/30 bg-fan-awayDim py-fan-base text-fan-body font-semibold text-fan-away"
      >
        Log Out
      </button>
    </div>
  );
}
