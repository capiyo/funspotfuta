import type { Channel } from '@funspot/core';

export function AppHeader({ channels, activeChannelId, loadingChannels, username, isLoggedIn, onSelectChannel, onLogout, onLogin, onRefresh, onEnableNotifications }: {
  channels: Channel[];
  activeChannelId: string | null;
  loadingChannels: boolean;
  username: string | null;
  isLoggedIn: boolean;
  onSelectChannel: (id: string) => void;
  onLogout: () => void;
  onLogin: () => void;
  onRefresh: () => void;
  onEnableNotifications: () => void | Promise<void>;
}) {
  return <header className="navbar">
    <a href="/" className="brand" aria-label="Funspot home">Funspot😂</a>
    <div className="navbar-channels" aria-label="Channels">
      {channels.map((channel) => <button key={channel.channelId} className={channel.channelId === activeChannelId ? 'channel-chip active' : 'channel-chip'} onClick={() => onSelectChannel(channel.channelId)}>{channel.name}</button>)}
      {loadingChannels && <span className="muted">Loading channels…</span>}
      {!loadingChannels && channels.length === 0 && <span className="muted">No channels available</span>}
    </div>
    <div className="navbar-actions">
      {isLoggedIn ? <><span className="username">{username}</span><button className="button button-quiet" onClick={onLogout}>Log out</button></> : <button className="button" onClick={onLogin}>Join</button>}
      <button className="button button-quiet" onClick={onEnableNotifications}>Enable notifications</button>
      <button className="button button-quiet" onClick={onRefresh} aria-label="Refresh channels">↻</button>
    </div>
  </header>;
}
