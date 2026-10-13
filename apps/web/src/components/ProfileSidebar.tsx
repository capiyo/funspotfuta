import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AddPostModal from '@/modals/addPostModal';
import type { Channel } from '@funspot/core';
import ProfileModal from '@/modals/profile/ProfileModal';
import { useLoginModal } from '@/modals/Login-modal-context';
import {
  MOCK_PROFILE,
  MOCK_PROFILE_CHANNELS,
  MOCK_PROFILE_LEADERBOARD,
} from '@/lib/mock-profile';

interface ProfileSidebarProps {
  channels: Channel[];
  setActiveChannelId: (channelId: string) => void;
  setActiveTab: (tab: 'Chats' | 'Feed') => void;
  isLoggedIn: boolean;
}

export default function ProfileSidebar({
  channels,
  setActiveChannelId,
  setActiveTab,
  isLoggedIn,
}: ProfileSidebarProps) {
  const loginModal = useLoginModal();
  const [profileOpen, setProfileOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const openLogin = () => loginModal?.requireLogin();

  return (
    <aside className="profile-sidebar profile-sidebar-rich no-scrollbar" aria-label="Profile and channels">
      {isLoggedIn ? (
        <>
          <button type="button" className="button sidebar-join" onClick={() => setPostModalOpen(true)}>Post</button>
          <AddPostModal visible={postModalOpen} onClose={() => setPostModalOpen(false)}
            onPostCreated={() => { void queryClient.invalidateQueries({ queryKey: ['feed'] }); }} />
          {!profileOpen && (
            <ProfileModal
              visible
              inline
              channels={channels}
              onClose={() => undefined}
              onViewProfile={() => setProfileOpen(true)}
              onSelectChannel={(channelId) => {
                setActiveChannelId(channelId);
                setActiveTab('Chats');
              }}
              onSelectChats={() => setActiveTab('Chats')}
            />
          )}
          {profileOpen && (
            <ProfileModal
              visible
              channels={channels}
              onClose={() => setProfileOpen(false)}
              onSelectChannel={(channelId) => {
                setActiveChannelId(channelId);
                setActiveTab('Chats');
                setProfileOpen(false);
              }}
              onSelectChats={() => setActiveTab('Chats')}
            />
          )}
        </>
      ) : (
        <>
          <button type="button" className="button sidebar-join mock-signin" onClick={openLogin}>
            Sign in with phone
          </button>
          <div className="mock-profile-content" aria-disabled="true">
            <button type="button" className="mock-profile-identity" onClick={openLogin} aria-label="Sign in to view profile">
              <span className="mock-profile-avatar">{MOCK_PROFILE.nickname[0]}</span>
              <span className="mock-profile-identity-copy">
                <strong>{MOCK_PROFILE.nickname}</strong>
                <span>@{MOCK_PROFILE.username}</span>
              </span>
            </button>
            <div className="mock-profile-fandom">
              <span>{MOCK_PROFILE.clubFan}</span>
              <span>{MOCK_PROFILE.countryFan}</span>
            </div>
            <div className="mock-profile-balance">
              <span>Balance</span>
              <strong>KES {MOCK_PROFILE.balance.toFixed(2)}</strong>
              <div className="mock-profile-wallet-actions">
                <button type="button" disabled>Deposit</button>
                <button type="button" disabled>Withdraw</button>
              </div>
            </div>
            <div className="mock-profile-stats">
              <div><span>Bets</span><strong>{MOCK_PROFILE.bets}</strong></div>
              <div><span>Points</span><strong>{MOCK_PROFILE.points}</strong></div>
              <div><span>Accuracy</span><strong>{MOCK_PROFILE.accuracy}%</strong></div>
            </div>
            <div className="sidebar-divider" />
            <p className="sidebar-label">YOUR CHANNELS</p>
            <div className="mock-readonly-list">
              {MOCK_PROFILE_CHANNELS.map((channel) => (
                <div className="mock-channel-row" key={channel.id}>
                  <span className="mock-channel-avatar">{channel.name[0]}</span>
                  <span className="mock-channel-copy">
                    <strong>{channel.name}</strong>
                    <span>{channel.role} · {channel.points} points</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="sidebar-divider" />
            <p className="sidebar-label">CHANNEL LEADERBOARD</p>
            <div className="mock-readonly-list">
              {MOCK_PROFILE_LEADERBOARD.map((member, index) => (
                <div className="mock-leaderboard-row" key={member.username}>
                  <span className="mock-leaderboard-rank">{index + 1}</span>
                  <span className="mock-channel-copy">
                    <strong>{member.username}</strong>
                    <span>{member.points} points · {member.accuracy}% accuracy</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mock-profile-note">Preview only · sign in to use your profile and channels</p>
          </div>
        </>
      )}
    </aside>
  );
}
