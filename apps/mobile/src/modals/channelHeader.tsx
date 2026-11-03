// lib/channelHeader.ts
//
// Shared by ArenaScreen and HistoryModal so both cards show the same
// channel identity (name, photo, leader).

import type { Channel } from '@funspot/core';
import type { ChannelHeaderData } from '@/components/ChatsCard';

// Leader = member with the highest seasonPoints. Name and points always
// come from the same member. Server-provided fields win when present.
export function channelHeaderOf(channel: Channel): ChannelHeaderData {
    const anyChannel = channel as any;
    let leaderName: string | null = anyChannel.leaderName ?? null;
    let leaderPoints: number | null = anyChannel.leaderPoints ?? null;

    if (leaderName == null || leaderPoints == null) {
        let best: { username?: string; seasonPoints?: number } | null = null;
        for (const m of channel.members ?? []) {
            if (!best || (m.seasonPoints ?? 0) > (best.seasonPoints ?? 0)) best = m;
        }
        if (best) {
            leaderName = leaderName ?? best.username ?? null;
            leaderPoints = leaderPoints ?? best.seasonPoints ?? 0;
        }
    }

    return {
        id: channel.channelId,
        name: channel.name,
        // Random but stable online photo per channel when none is set.
        imageUrl:
            anyChannel.imageUrl ??
            `https://picsum.photos/seed/${encodeURIComponent(channel.channelId)}/96`,
        leaderName,
        leaderPoints,
        unreadCount: anyChannel.unreadCount ?? 0,
    };
}