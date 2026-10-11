/* eslint no-undef: "off" */
import { useEffect, useRef, useState } from 'react';
import type { Channel } from '@funspot/core';
import { useChannelChat } from '@/lib/api/use-channel-chat';

export default function MessageScreen({ channel, userId, username, authToken }: {
  channel: Channel; userId: string | null; username: string | null; authToken: string | null;
}) {
  const chat = useChannelChat({ channelId: channel.channelId, userId, username, authToken });
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [chat.messages.length]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !userId || !username || !authToken) return;
    setDraft('');
    try { await chat.send(text); } catch { setDraft(text); }
  }
  return <div className="message-screen">
    <div className="message-heading"><span className="channel-avatar">{channel.name?.slice(0,1)?.toUpperCase() ?? '#'}</span><div><strong>{channel.name}</strong><small>{chat.connected ? 'Connected' : 'Connecting…'}</small></div></div>
    <div className="message-list" ref={listRef} aria-live="polite">
      {chat.loadingHistory && <p className="muted message-status">Loading messages…</p>}
      {!chat.loadingHistory && chat.messages.length === 0 && <p className="muted message-status">No messages yet. Start the conversation.</p>}
      {chat.messages.map((message) => <div className={message.userId === userId ? 'message-bubble own' : 'message-bubble'} key={message.id}><strong>{message.username}</strong><p>{message.text ?? message.message ?? ''}</p><time>{message.timestamp instanceof Date ? message.timestamp.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</time></div>)}
    </div>
    <form className="message-composer" onSubmit={submit}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={userId ? 'Write a message…' : 'Sign in to send messages'} aria-label="Message" disabled={!userId || !authToken} /><button className="button" type="submit" disabled={!draft.trim() || !userId || !authToken}>Send</button></form>
  </div>;
}
