'use client';

// Ported 1:1 from lib/widgets/web_navbar.dart.
// Height 48, FanColors.surfaceElevated background, plain text channels
// (no pill backgrounds), underline-only search, gold leader pill on
// member chips, red gradient notification badge, gradient-ring avatar.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Plus,
  Crown,
  Trophy,
  Shield,
  Flag,
  Circle,
  User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export interface NavbarChannel {
  channelId: string;
  name: string;
  isAdmin?: boolean;
  members?: { username: string; seasonPoints: number }[];
}

export function WebNavbar({
  channels = [],
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  notificationCount = 0,
  onNotificationTap,
  onMenuTap,
  nickname,
  teamName,
  country,
}: {
  channels?: NavbarChannel[];
  activeChannelId?: string;
  onSelectChannel?: (id: string) => void;
  onCreateChannel?: () => void;
  notificationCount?: number;
  onNotificationTap?: () => void;
  onMenuTap?: () => void;
  nickname?: string;
  teamName?: string;
  country?: string;
}) {
  const { isLoggedIn, userId, username } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const hasProfileInfo = !!(nickname || teamName || country);

  const avatarUrl = (() => {
    const POOL = [1, 3, 5, 7, 8, 11, 12, 14, 15, 16, 18, 22, 25, 28, 32, 33, 36, 41, 44, 47];
    const key = userId || 'guest';
    const hash = key.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
    return `https://i.pravatar.cc/150?img=${POOL[hash % POOL.length]}`;
  })();

  return (
    <div className="flex h-12 items-center bg-fan-surfaceElevated">
      <div className="ml-[18px] flex items-center">
        <Logo />
      </div>
      <div className="ml-4" />

      {isLoggedIn && hasProfileInfo && (
        <>
          <ProfileInfo
            nickname={nickname}
            teamName={teamName}
            country={country}
          />
          <div className="ml-4" />
        </>
      )}

      {/* Channels — plain text row */}
      <ChannelDisplay
        isLoggedIn={isLoggedIn}
        channels={channels}
        activeChannelId={activeChannelId}
        onSelect={onSelectChannel}
        onJoin={(id) => onSelectChannel?.(id)}
      />

      <div className="flex-1" />

      {/* Search — underline only */}
      <div className="h-[30px] w-[168px]">
        <div className="flex h-full items-center gap-1.5">
          <Search size={16} className="text-fan-textTertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full bg-transparent text-[12.5px] font-medium text-fan-textPrimary outline-none placeholder:font-normal placeholder:text-fan-textTertiary"
          />
        </div>
      </div>

      <div className="ml-3" />

      {/* User's channel chips */}
      {isLoggedIn && (
        <div className="flex max-w-[260px] items-center gap-1.5 overflow-x-auto">
          {channels.length === 0 ? (
            <>
              <span className="whitespace-nowrap text-[11px] text-fan-textTertiary">
                No channels joined
              </span>
              <CreateChip onClick={onCreateChannel} />
            </>
          ) : (
            <>
              {channels.map((c) => (
                <MemberChip
                  key={c.channelId}
                  channel={c}
                  isSelected={
                    activeChannelId
                      ? activeChannelId === c.channelId
                      : channels[0]?.channelId === c.channelId
                  }
                  onSelect={() => onSelectChannel?.(c.channelId)}
                />
              ))}
              <CreateChip onClick={onCreateChannel} />
            </>
          )}
        </div>
      )}

      <div className="ml-3" />

      <NotificationBell
        count={notificationCount}
        onClick={onNotificationTap ?? (() => navigate('/notifications'))}
      />

      <div className="ml-3" />

      <Avatar
        isLoggedIn={!!isLoggedIn}
        url={avatarUrl}
        onClick={onMenuTap ?? (() => navigate('/profile'))}
      />

      <div className="mr-[18px]" />
    </div>
  );
}

// ── Logo ────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center">
      <div
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full p-[1.6px]"
        style={{
          background:
            'linear-gradient(135deg, #6EE7B7 0%, #34D399 50%, #059669 100%)',
          boxShadow: '0 0 10px 0.5px rgba(52,211,153,0.45)',
        }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#07291E] p-[4.5px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/app_icon.png" alt="" className="h-full w-full object-cover" />
        </div>
      </div>
      <div className="ml-[10px] text-[16px] font-extrabold leading-none tracking-[-0.2px] text-white">
        Funspot
      </div>
      <div
        className="ml-[7px] rounded-[6px] border-[0.6px] border-white/35 px-[6px] py-[2.5px] text-[7.5px] font-extrabold leading-none tracking-[1.1px] text-[#0B3D2E]"
        style={{
          background:
            'linear-gradient(135deg, #FFE9A8 0%, #F5B841 50%, #D68F0E 100%)',
          boxShadow: '0 0 8px 0 rgba(245,184,65,0.55)',
        }}
      >
        BETA
      </div>
    </div>
  );
}

// ── Profile info row ────────────────────────────────────────────
function ProfileInfo({
  nickname,
  teamName,
  country,
}: {
  nickname?: string;
  teamName?: string;
  country?: string;
}) {
  const items: { icon: React.ReactNode; value: string }[] = [];
  if (nickname) items.push({ icon: <Shield size={12} className="text-fan-textTertiary" />, value: nickname });
  if (teamName) items.push({ icon: <span className="text-[12px] leading-none">⚽</span>, value: teamName });
  if (country) items.push({ icon: <Flag size={12} className="text-fan-textTertiary" />, value: country });

  return (
    <div className="flex items-center">
      {items.map((it, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && <span className="mx-[9px] h-[14px] w-px bg-fan-border/30" />}
          <div className="flex items-center gap-1.5">
            {it.icon}
            <span className="max-w-[100px] truncate text-[11.5px] font-medium leading-none text-fan-textSecondary">
              {it.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Channel display (all channels) ──────────────────────────────
function ChannelDisplay({
  isLoggedIn,
  channels,
  activeChannelId,
  onSelect,
  onJoin,
}: {
  isLoggedIn: boolean;
  channels: NavbarChannel[];
  activeChannelId?: string;
  onSelect?: (id: string) => void;
  onJoin?: (id: string) => void;
}) {
  if (!isLoggedIn) {
    return (
      <span className="text-[12px] font-normal leading-none text-fan-textTertiary">
        Browse channels
      </span>
    );
  }
  if (channels.length === 0) {
    return (
      <span className="text-[12px] font-normal leading-none text-fan-textTertiary">
        No channels available
      </span>
    );
  }

  const display = channels.slice(0, 3);
  const hasMore = channels.length > 3;

  return (
    <div className="flex items-center">
      {display.map((c) => {
        const isMember = c.channelId === activeChannelId;
        return (
          <div key={c.channelId} className="mr-2 flex items-center">
            <button
              onClick={() => onSelect?.(c.channelId)}
              className={`text-[12px] leading-none ${isMember
                  ? 'font-semibold text-fan-primary'
                  : 'font-normal text-fan-textSecondary'
                }`}
            >
              {c.name}
            </button>
            <div className="ml-[3px]">
              {isMember ? (
                <Circle size={4} className="fill-fan-primary text-fan-primary" />
              ) : (
                <button
                  onClick={() => onJoin?.(c.channelId)}
                  className="text-[12px] font-semibold leading-none text-fan-primary"
                >
                  +
                </button>
              )}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <span className="text-[10px] font-medium leading-none text-fan-textTertiary">
          +{channels.length - 3}
        </span>
      )}
    </div>
  );
}

// ── Member chip ─────────────────────────────────────────────────
function MemberChip({
  channel,
  isSelected,
  onSelect,
}: {
  channel: NavbarChannel;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const leader = channel.members?.length
    ? [...channel.members].sort((a, b) => b.seasonPoints - a.seasonPoints)[0]
    : null;

  return (
    <div className="flex items-center">
      {channel.isAdmin && (
        <>
          <Crown size={10} className="text-amber-400" />
          <div className="w-[2px]" />
        </>
      )}
      <button
        onClick={onSelect}
        className={`px-[8px] py-[5px] text-[12px] font-bold leading-none tracking-[-0.1px] ${isSelected ? 'text-fan-primary' : 'text-fan-textPrimary'
          }`}
      >
        {channel.name}
      </button>
      {leader && (
        <button
          onClick={onSelect}
          className="ml-[2px] mr-[6px] flex items-center gap-[3px] rounded-[7px] px-[6px] py-[2.5px]"
          style={{
            background:
              'linear-gradient(135deg, #FFE9A8 0%, #F5B841 50%, #D68F0E 100%)',
            boxShadow: '0 0 5px 0 rgba(245,184,65,0.35)',
          }}
        >
          <Trophy size={9} className="text-[#0B3D2E]" />
          <span className="text-[9px] font-extrabold leading-none text-[#0B3D2E]">
            {leader.username} · {leader.seasonPoints}
          </span>
        </button>
      )}
    </div>
  );
}

function CreateChip({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[0.8px] border-fan-primary/40 bg-fan-primary/[0.08]"
    >
      <Plus size={15} className="text-fan-primary" />
    </button>
  );
}

// ── Notification bell ───────────────────────────────────────────
function NotificationBell({
  count,
  onClick,
}: {
  count: number;
  onClick?: () => void;
}) {
  const has = count > 0;
  return (
    <button onClick={onClick} className="relative p-1.5">
      <Bell
        size={19}
        className={has ? 'text-fan-primary' : 'text-fan-textSecondary'}
      />
      {has && (
        <span
          className="absolute -right-[5px] -top-[3px] flex min-h-[15px] min-w-[15px] items-center justify-center rounded-full border-[1.4px] border-fan-surfaceElevated p-[3px] text-[7.5px] font-extrabold leading-none text-white"
          style={{
            background: 'linear-gradient(135deg, #FF6B6B 0%, #E0303A 100%)',
            boxShadow: '0 0 4px 0 rgba(224,48,58,0.5)',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// ── Avatar ──────────────────────────────────────────────────────
function Avatar({
  isLoggedIn,
  url,
  onClick,
}: {
  isLoggedIn: boolean;
  url: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full p-[1.8px]"
      style={{
        background: 'linear-gradient(135deg, #6EE7B7 0%, #FFD166 100%)',
        boxShadow: '0 0 8px 0 rgba(255,209,102,0.35)',
      }}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-fan-surfaceElevated">
        {isLoggedIn ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <User size={15} className="text-fan-textTertiary" />
        )}
      </div>
    </button>
  );
}