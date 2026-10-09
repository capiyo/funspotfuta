'use client';

// Corresponds to the "Profile" tab. Session display + logout are wired
// against the ported AuthProvider; wallet is real (payment-service.ts);
// comrades/leaderboard/history now have real pages, linked below since
// they aren't on the 5-item bottom nav (matching the original app, which
// reaches them via in-page buttons rather than tabs).

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Users, Trophy, History, Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { getProfile, saveProfile, type UserProfile } from '@funspot/core';
import { WalletCard } from '@/components/WalletCard';

const LINKS = [
  { href: '/comrades', label: 'Comrades', Icon: Users },
  { href: '/leaderboard', label: 'Leaderboard', Icon: Trophy },
  { href: '/history', label: 'Match History', Icon: History },
  { href: '/notifications', label: 'Notifications', Icon: Bell },
] as const;

export default function ProfilePage() {
  const { username, phone, userId, authToken, logout } = useAuth();
  const { profileId } = useParams<{ profileId?: string }>();
  const viewedUserId = profileId ?? userId;
  const isOwnProfile = !profileId || profileId === userId;
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [profileRetry, setProfileRetry] = useState(0);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nickname, setNickname] = useState('');
  const [clubFan, setClubFan] = useState('');
  const [countryFan, setCountryFan] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!viewedUserId) { setProfileLoading(false); return; }
    setProfileLoading(true);
    setProfileError(false);
    setProfile(null);
    getProfile(viewedUserId, authToken ?? undefined)
      .then((result) => {
        if (!mounted) return;
        setProfile(result);
        setNickname(result?.nickname ?? '');
        setClubFan(result?.clubFan ?? '');
        setCountryFan(result?.countryFan ?? '');
      })
      .catch((error) => {
        console.error('Could not load profile', error);
        if (mounted) {
          setProfileError(true);
          toast.showError(isOwnProfile ? 'Could not load your profile. Please try again.' : 'Could not load this user profile. Please try again.');
        }
      })
      .finally(() => { if (mounted) setProfileLoading(false); });
    return () => { mounted = false; };
  }, [viewedUserId, authToken, profileRetry]);

  async function handleSaveProfile() {
    if (!userId) return;
    if (!nickname.trim() || !clubFan.trim() || !countryFan.trim()) {
      toast.showError('Nickname, favorite club and country are required.');
      return;
    }
    setSavingProfile(true);
    try {
      const ok = await saveProfile({ userId, nickname: nickname.trim(), clubFan: clubFan.trim(), countryFan: countryFan.trim(), authToken: authToken ?? undefined });
      if (!ok) {
        toast.showError('Could not save your profile. Please try again.');
        return;
      }
      setProfile((current) => current ? { ...current, nickname: nickname.trim(), clubFan: clubFan.trim(), countryFan: countryFan.trim() } : { userId, username: username ?? '', phone: phone ?? '', nickname: nickname.trim(), clubFan: clubFan.trim(), countryFan: countryFan.trim(), numberOfBets: 0, balance: 0 });
      setEditingProfile(false);
      toast.showSuccess('Profile saved.');
    } catch (error) {
      console.error('Could not save profile:', error);
      toast.showError('Could not save your profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      toast.showError('Could not log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-fan-xxl pt-10">
      {profileId && (
        <button type="button" onClick={() => navigate(-1)} className="mb-fan-lg rounded-fan-pill border border-fan-border px-fan-md py-fan-sm text-fan-caption text-fan-textSecondary">← Back</button>
      )}
      <div className="mb-fan-xxl flex flex-col items-center">
        <div className="mb-fan-base flex h-20 w-20 items-center justify-center rounded-fan-pill bg-fan-primary/20 text-2xl font-bold text-fan-primary">
          {(profile?.nickname || profile?.username || username || '?').charAt(0).toUpperCase()}
        </div>
        <h1 className="font-condensed text-fan-headline text-fan-textPrimary">{profile?.nickname || profile?.username || (isOwnProfile ? username : 'Fan profile')}</h1>
        {isOwnProfile && phone && <p className="text-fan-body text-fan-textTertiary">{phone}</p>}
        {isOwnProfile && <p className="mt-fan-sm text-fan-caption text-fan-textTertiary">ID: {userId}</p>}
        {!isOwnProfile && profile?.username && <p className="text-fan-body text-fan-textTertiary">@{profile.username}</p>}
      </div>

      {profileLoading ? (
        <p role="status" className="mb-fan-lg text-center text-fan-caption text-fan-textTertiary">Loading profile…</p>
      ) : profileError ? (
        <div role="alert" className="mb-fan-lg rounded-fan-lg border border-fan-border bg-fan-surface p-fan-lg text-center">
          <p className="mb-fan-md text-fan-caption text-fan-textTertiary">{isOwnProfile ? 'Your profile details could not be loaded.' : 'This profile could not be loaded.'}</p>
          <button onClick={() => setProfileRetry((value) => value + 1)} className="rounded-fan-pill border border-fan-border px-fan-lg py-fan-sm text-fan-caption font-semibold text-fan-textSecondary">Try again</button>
        </div>
      ) : null}

      <section className="mb-fan-xxl rounded-fan-xl border border-fan-border bg-fan-surface p-fan-lg">
        <div className="mb-fan-md flex items-center justify-between">
          <h2 className="font-semibold text-fan-body text-fan-textPrimary">Fan profile</h2>
          {isOwnProfile && !editingProfile && <button onClick={() => setEditingProfile(true)} className="text-fan-caption font-semibold text-fan-primary">Edit</button>}
        </div>
        {profileLoading ? (
          <p className="text-fan-caption text-fan-textTertiary">Loading profile…</p>
        ) : editingProfile ? (
          <div className="space-y-fan-md">
            <label className="block text-fan-caption text-fan-textSecondary">Nickname<input value={nickname} onChange={(event) => setNickname(event.target.value)} className="mt-fan-xs w-full rounded-fan-md border border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-sm text-fan-body text-fan-textPrimary" /></label>
            <label className="block text-fan-caption text-fan-textSecondary">Favorite club<input value={clubFan} onChange={(event) => setClubFan(event.target.value)} className="mt-fan-xs w-full rounded-fan-md border border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-sm text-fan-body text-fan-textPrimary" /></label>
            <label className="block text-fan-caption text-fan-textSecondary">Country<input value={countryFan} onChange={(event) => setCountryFan(event.target.value)} className="mt-fan-xs w-full rounded-fan-md border border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-sm text-fan-body text-fan-textPrimary" /></label>
            <div className="flex gap-fan-sm">
              <button onClick={handleSaveProfile} disabled={savingProfile} className="flex-1 rounded-fan-lg bg-fan-primary py-fan-sm text-fan-caption font-semibold text-fan-textInverse disabled:opacity-50">{savingProfile ? 'Saving…' : 'Save profile'}</button>
              <button onClick={() => { setNickname(profile?.nickname ?? ''); setClubFan(profile?.clubFan ?? ''); setCountryFan(profile?.countryFan ?? ''); setEditingProfile(false); }} disabled={savingProfile} className="rounded-fan-lg border border-fan-border px-fan-lg py-fan-sm text-fan-caption text-fan-textSecondary">Cancel</button>
            </div>
          </div>
        ) : profile && (profile.nickname || profile.clubFan || profile.countryFan) ? (
          <div className="grid grid-cols-1 gap-fan-sm text-fan-body">
            <p className="text-fan-textSecondary">Nickname: <span className="text-fan-textPrimary">{profile.nickname || '—'}</span></p>
            <p className="text-fan-textSecondary">Favorite club: <span className="text-fan-textPrimary">{profile.clubFan || '—'}</span></p>
            <p className="text-fan-textSecondary">Country: <span className="text-fan-textPrimary">{profile.countryFan || '—'}</span></p>
          </div>
        ) : profile && (profile.nickname || profile.clubFan || profile.countryFan) ? (
          <div className="grid grid-cols-1 gap-fan-sm text-fan-body">
            <p className="text-fan-textSecondary">Nickname: <span className="text-fan-textPrimary">{profile.nickname || '—'}</span></p>
            <p className="text-fan-textSecondary">Favorite club: <span className="text-fan-textPrimary">{profile.clubFan || '—'}</span></p>
            <p className="text-fan-textSecondary">Country: <span className="text-fan-textPrimary">{profile.countryFan || '—'}</span></p>
          </div>
        ) : (
          <p className="text-fan-caption text-fan-textTertiary">{isOwnProfile ? 'Complete your fan profile with a nickname, favorite club and country.' : 'This user has not shared fan profile details.'}</p>
        )}
      </section>

      {isOwnProfile && (
        <>
      <div className="mb-fan-xxl overflow-hidden rounded-fan-xl border border-fan-border bg-fan-surface">
        {LINKS.map(({ href, label, Icon }, i) => (
          <Link
            key={href}
            to={href}
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
        disabled={loggingOut}
        className="w-full rounded-fan-lg border border-fan-away/30 bg-fan-awayDim py-fan-base text-fan-body font-semibold text-fan-away"
      >
        {loggingOut ? 'Logging out…' : 'Log Out'}
      </button>
        </>
      )}
    </div>
  );
}
