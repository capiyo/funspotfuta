'use client';

// Ported functionality-wise from the app's ChatScreen: pick a channel, chat
// live over the WebSocket (with REST history + fallback), now with image
// sending (uploadChatImage + sendChannelMessage from api_services.dart).
// Video/typing-indicators/reply-threading UI are still follow-up (see
// README) — message send/receive, including images, is fully live here.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserChannels, Channel } from '@funspot/core';
import { useChannelChat } from '@/lib/api/use-channel-chat';
import { useToast } from '@/lib/toast/toast-context';
import { Image as ImageIcon } from 'lucide-react';

export default function ChatPage() {
  const { userId, username, authToken } = useAuth();
  const toast = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId || !authToken) return;
    getUserChannels(userId, authToken).then((c) => {
      setChannels(c);
      setActiveChannelId((prev) => prev ?? c[0]?.id ?? null);
    });
  }, [userId, authToken]);

  const { messages, connected, loadingHistory, uploadingImage, send, sendImage } = useChannelChat({
    channelId: activeChannelId,
    userId,
    username,
    authToken,
  });

  async function handleSend() {
    if (!draft.trim()) return;
    await send(draft.trim());
    setDraft('');
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await sendImage(file);
    } catch (err: any) {
      toast.showError(err?.message ?? 'Failed to send image');
    }
  }

  if (channels.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-gray-400">Join or create a channel to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-md flex-col px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <select
          value={activeChannelId ?? ''}
          onChange={(e) => setActiveChannelId(e.target.value)}
          className="rounded-lg border border-white/10 bg-funspot-surface px-3 py-1.5 text-sm text-white"
        >
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className={`text-xs ${connected ? 'text-funspot-green' : 'text-gray-500'}`}>
          {connected ? '● live' : '○ connecting…'}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3">
        {loadingHistory ? (
          <p className="text-center text-xs text-gray-500">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-500">No messages yet — say something.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.userId === userId ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  m.userId === userId ? 'bg-funspot-green text-black' : 'bg-white/10 text-white'
                } ${m.isPending ? 'opacity-60' : ''}`}
              >
                {m.userId !== userId && <p className="mb-0.5 text-[10px] font-semibold opacity-70">{m.username}</p>}
                {m.isImage && m.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="mb-1 max-h-56 rounded-lg object-cover" />
                )}
                {m.text && <p>{m.text}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="my-3 flex gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          className="flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 text-gray-300 disabled:opacity-50"
          aria-label="Send image"
        >
          <ImageIcon size={18} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={uploadingImage ? 'Uploading image…' : 'Message…'}
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-funspot-green"
        />
        <button
          onClick={handleSend}
          className="rounded-full bg-funspot-green px-4 py-2 text-sm font-semibold text-black"
        >
          Send
        </button>
      </div>
    </div>
  );
}
