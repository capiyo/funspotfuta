import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Channel } from '@funspot/core';
import AddPostModal from '@/modals/addPostModal';
import ProfileModal from '@/modals/profile/ProfileModal';

interface ProfileSidebarProps {
  channels: Channel[];
  setActiveChannelId: (channelId: string) => void;
  setActiveTab: (tab: 'Chats' | 'Feed') => void;
  isLoggedIn: boolean;
  onOpenChannel?: (channelId: string) => void;
}

/**
 * The sidebar is a container for the same ProfileModal content used by the
 * menu. Keep profile data and behavior in the profile flow, not in a second
 * mock-only sidebar implementation.
 */
export default function ProfileSidebar({
  channels,
  setActiveChannelId,
  setActiveTab,
  isLoggedIn,
  onOpenChannel,
}: ProfileSidebarProps) {
  const [postModalOpen, setPostModalOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <aside className="profile-sidebar profile-sidebar-rich no-scrollbar" aria-label="Profile">
      {isLoggedIn && (
        <>
          <div className="profile-sidebar-post-action">
            <button type="button" className="button sidebar-join" onClick={() => setPostModalOpen(true)}>
              Post
            </button>
          </div>
          <AddPostModal
            visible={postModalOpen}
            onClose={() => setPostModalOpen(false)}
            onPostCreated={() => { void queryClient.invalidateQueries({ queryKey: ['feed'] }); }}
          />
        </>
      )}
      <ProfileModal
        visible
        inline
        channels={channels}
        onClose={() => undefined}
        onSelectChannel={(channelId) => {
          setActiveChannelId(channelId);
          setActiveTab('Chats');
          onOpenChannel?.(channelId);
        }}
        onSelectChats={() => setActiveTab('Chats')}
      />
    </aside>
  );
}
