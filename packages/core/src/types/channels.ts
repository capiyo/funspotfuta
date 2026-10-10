// types/channel.ts
//
// Direct port of funspot/lib/models/user_channel.dart — UserChannel +
// ChannelMember. Keeps the same defensive-parsing behavior: individual
// field coercion (never a blind cast), fallback on any parse failure so
// one bad record never blanks a whole list, and support for Mongo
// Extended JSON shapes ({"$oid": "..."}, {"$date": {"$numberLong": "..."}})
// leaking through from the Rust/BSON backend.
//
// NOTE: unlike posts/channel-api's channelFromJson (now superseded by
// this file), `isAdmin` on a Channel is NOT a raw JSON field — Dart
// derives it as `members.any((m) => m.isAdmin)`, and a member's isAdmin
// is itself derived from `role`. Both are computed here at parse time,
// not read directly off the wire.

// ============================================================================
// SAFE PARSING HELPERS — ports of _asString / _asInt / _asBool /
// _asStringList / _asDateTime
// ============================================================================

function asString(value: any, fallback = ''): string {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        // Mongo Extended JSON: {"$oid": "..."} or {"$date": {"$numberLong": "..."}}
        if ('$oid' in value) return value['$oid']?.toString() ?? fallback;
        if ('$date' in value) {
            const d = value['$date'];
            if (d && typeof d === 'object' && '$numberLong' in d) {
                const millis = parseInt(d['$numberLong'], 10);
                if (!Number.isNaN(millis)) {
                    return new Date(millis).toISOString();
                }
            }
            return d?.toString() ?? fallback;
        }
        // Unknown object shape — don't throw, just stringify as a last resort.
        return String(value);
    }
    return String(value);
}

function asInt(value: any, fallback = 0): number {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') return Math.trunc(value);
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        return Number.isNaN(n) ? fallback : n;
    }
    if (typeof value === 'object') {
        if ('$numberInt' in value) {
            const n = parseInt(value['$numberInt'], 10);
            return Number.isNaN(n) ? fallback : n;
        }
        if ('$numberLong' in value) {
            const n = parseInt(value['$numberLong'], 10);
            return Number.isNaN(n) ? fallback : n;
        }
    }
    return fallback;
}

function asBool(value: any, fallback = false): boolean {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return fallback;
}

function asStringList(value: any): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((e) => asString(e)).filter((s) => s.length > 0);
}

function asDateTime(value: any): Date | null {
    if (value === null || value === undefined) return null;
    const s = asString(value);
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

// ============================================================================
// CHANNEL MEMBER
// ============================================================================

export interface ChannelMember {
    userId: string;
    username: string;
    role: string; // lowercased: 'member' | 'moderator' | 'admin' | 'owner'
    joinedAt: Date;
    seasonPoints: number;
    correctVotes: number;
    totalVotes: number;
    msgCount: number;
}

export function channelMemberFromJson(json: Record<string, any>): ChannelMember {
    try {
        return {
            userId: asString(json.user_id ?? json.userId),
            username: asString(json.username ?? json.user_name, 'Anonymous'),
            role: asString(json.role, 'member').toLowerCase(),
            joinedAt: asDateTime(json.joined_at ?? json.joinedAt) ?? new Date(),
            seasonPoints: asInt(json.season_points ?? json.seasonPoints),
            correctVotes: asInt(json.correct_votes ?? json.correctVotes),
            totalVotes: asInt(json.total_votes ?? json.totalVotes),
            msgCount: asInt(json.msg_count ?? json.msgCount),
        };
    } catch (e) {
        console.warn('⚠️ channelMemberFromJson failed, returning safe fallback:', e, json);
        return {
            userId: asString(json.user_id ?? json.userId),
            username: 'Anonymous',
            role: 'member',
            joinedAt: new Date(),
            seasonPoints: 0,
            correctVotes: 0,
            totalVotes: 0,
            msgCount: 0,
        };
    }
}

export function channelMemberToJson(m: ChannelMember): Record<string, any> {
    return {
        user_id: m.userId,
        username: m.username,
        role: m.role,
        joined_at: m.joinedAt.toISOString(),
        season_points: m.seasonPoints,
        correct_votes: m.correctVotes,
        total_votes: m.totalVotes,
        msg_count: m.msgCount,
    };
}

// ── ChannelMember computed helpers (Dart getters) ──────────────────────────

export function memberIsAdmin(m: ChannelMember): boolean {
    return m.role === 'admin' || m.role === 'owner';
}

export function memberIsModerator(m: ChannelMember): boolean {
    return m.role === 'moderator' || m.role === 'admin' || m.role === 'owner';
}

export function memberIsMember(m: ChannelMember): boolean {
    return m.role === 'member';
}

export function memberIsOwner(m: ChannelMember): boolean {
    return m.role === 'owner';
}

export function memberVoteAccuracy(m: ChannelMember): number {
    if (m.totalVotes === 0) return 0;
    return (m.correctVotes / m.totalVotes) * 100;
}

export function memberAccuracyLabel(m: ChannelMember): string {
    const accuracy = memberVoteAccuracy(m);
    if (accuracy >= 80) return '🏆 Excellent';
    if (accuracy >= 60) return '⭐ Good';
    if (accuracy >= 40) return '📊 Average';
    return '📈 Needs Improvement';
}

// ============================================================================
// CHANNEL (UserChannel)
// ============================================================================

export interface Channel {
    /** Legacy mobile alias; always mirrors channelId. */
    id: string;
    channelId: string;
    name: string;
    memberCount: number;
    season: string;
    isAdmin: boolean; // derived: members.some(memberIsAdmin)
    admins: string[] | null;
    memberIds: string[];
    inviteCode: string;
    members: ChannelMember[];
    isApproved: boolean;
    isActive: boolean;
    description: string | null;
    joinedAt: Date | null;
}

export function channelFromJson(json: Record<string, any>): Channel {
    try {
        const membersData: any[] = Array.isArray(json.members) ? json.members : [];
        const members: ChannelMember[] = membersData
            .filter((m) => m && typeof m === 'object')
            .map((m) => channelMemberFromJson(m));

        const isApproved = asBool(json.isApproved ?? json.is_approved ?? json.approved, false);
        const isActive = asBool(json.isActive ?? json.is_active, true);
        const hasAdmin = members.some(memberIsAdmin);
        const joinedAt = asDateTime(json.joinedAt ?? json.joined_at);

        const channelId = asString(json.channel_id ?? json.channelId ?? json._id ?? json.id);
        return {
            id: channelId,
            channelId,
            name: asString(json.name ?? json.channelName, 'Unknown Channel'),
            memberCount: asInt(json.member_count ?? json.memberCount),
            season: asString(json.season),
            isAdmin: hasAdmin,
            admins: json.admins != null ? asStringList(json.admins) : null,
            memberIds: members.map((m) => m.userId).filter((id) => id.length > 0),
            inviteCode: asString(json.invite_code ?? json.inviteCode),
            members,
            isApproved,
            isActive,
            description: json.description != null ? asString(json.description) : null,
            joinedAt,
        };
    } catch (e) {
        console.warn('⚠️ channelFromJson failed, returning safe fallback:', e, json);
        const channelId = asString(json.channel_id ?? json.channelId ?? json._id ?? json.id);
        return {
            id: channelId,
            channelId,
            name: 'Unknown Channel',
            memberCount: 0,
            season: '',
            isAdmin: false,
            admins: null,
            memberIds: [],
            inviteCode: '',
            members: [],
            isApproved: false,
            isActive: true,
            description: null,
            joinedAt: null,
        };
    }
}

export function channelToJson(c: Channel): Record<string, any> {
    return {
        channel_id: c.channelId,
        name: c.name,
        member_count: c.memberCount,
        season: c.season,
        is_admin: c.isAdmin,
        member_ids: c.memberIds,
        members: c.members.map(channelMemberToJson),
        is_approved: c.isApproved,
        is_active: c.isActive,
        ...(c.description != null ? { description: c.description } : {}),
        ...(c.joinedAt != null ? { joined_at: c.joinedAt.toISOString() } : {}),
    };
}

// ── Channel computed helpers (Dart getters/methods) ────────────────────────

export function channelIsMember(c: Channel): boolean {
    return c.isApproved && c.isActive;
}

export function channelIsPending(c: Channel): boolean {
    return !c.isApproved && c.isActive;
}

export function channelIsActiveMember(c: Channel): boolean {
    return c.isApproved && c.isActive;
}

export function channelIsInactive(c: Channel): boolean {
    return !c.isActive;
}

export function isUserAdmin(c: Channel, userId: string): boolean {
    return c.members.some((m) => m.userId === userId && memberIsAdmin(m));
}

export function adminMembers(c: Channel): ChannelMember[] {
    return c.members.filter(memberIsAdmin);
}

export function regularMembers(c: Channel): ChannelMember[] {
    return c.members.filter((m) => !memberIsAdmin(m));
}

export function getMember(c: Channel, userId: string): ChannelMember | undefined {
    return c.members.find((m) => m.userId === userId);
}

// Convenience factory for placeholder/"unknown channel" fallbacks — mirrors
// Dart's `orElse: () => UserChannel(channelId: '', name: '', ...)` pattern
// used in _getChannelName and PendingRequestsModal.
export function emptyChannel(): Channel {
    return {
        channelId: '',
        name: 'Unknown',
        memberCount: 0,
        season: '',
        isAdmin: false,
        admins: null,
        memberIds: [],
        inviteCode: '',
        members: [],
        isApproved: false,
        isActive: true,
        description: null,
        joinedAt: null,
    };
}