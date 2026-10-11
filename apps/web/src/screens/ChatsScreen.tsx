import type { Channel } from '@funspot/core';
import MessageScreen from '@/screens/MessageScreen';
import { useAuth } from '@/lib/auth-context';

export default function ChatsScreen({ channels, activeChannel, onSelectChannel, loading }: {
  channels: Channel[];
  activeChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  loading: boolean;
}) {
  const { userId, username, authToken } = useAuth();
  return <div className="pane-content">
    <div className="pane-heading"><div><p className="eyebrow">COMMUNITY</p><h1>Chats</h1></div><span className="count">{channels.length}</span></div>
    {loading ? <div className="skeleton-list" aria-label="Loading chats">{[0,1,2,3].map((i) => <div className="skeleton-row" key={i} />)}</div> :
      channels.length === 0 ? <div className="empty-state"><h2>No channels yet</h2><p>Channels you belong to will appear here.</p></div> :
      <div className="chat-layout">
        <div className="channel-list" role="list" aria-label="Channel list">
          {channels.map((channel) => <button role="listitem" key={channel.channelId} className={activeChannel?.channelId === channel.channelId ? 'channel-row selected' : 'channel-row'} onClick={() => onSelectChannel(channel)}>
            <span className="channel-avatar">{channel.name?.slice(0,1)?.toUpperCase() ?? '#'}</span><span className="channel-row-copy"><strong>{channel.name}</strong><small>{channel.members?.length ?? 0} members</small></span><span aria-hidden="true">›</span>
          </button>)}
        </div>
        <div className="message-pane">
          {activeChannel ? <MessageScreen channel={activeChannel} userId={userId} username={username} authToken={authToken} /> : <div className="empty-state">Choose a channel to open its conversation.</div>}
        </div>
      </div>}
  </div>;
}
