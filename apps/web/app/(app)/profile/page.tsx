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
    <div className="mx-auto max-w-md px-6 pt-10">
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-funspot-green/20 text-2xl font-bold text-funspot-green">
          {(username ?? '?').charAt(0).toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-white">{username}</h1>
        {phone && <p className="text-sm text-gray-500">{phone}</p>}
        <p className="mt-1 text-xs text-gray-600">ID: {userId}</p>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-funspot-surface">
        {LINKS.map(({ href, label, Icon }, i) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-4 py-3 text-sm text-white ${
              i > 0 ? 'border-t border-white/5' : ''
            }`}
          >
            <Icon size={18} className="text-funspot-green" />
            <span className="flex-1">{label}</span>
            <ChevronRight size={16} className="text-gray-500" />
          </Link>
        ))}
      </div>

      <WalletCard />

      <button
        onClick={handleLogout}
        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400"
      >
        Log Out
      </button>
    </div>
  );
}
