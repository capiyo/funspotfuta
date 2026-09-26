// components/HistoryCard.tsx
//
// Same design as MatchCard, row for row:
//
//   league (white) / Full time                       2h        <- date untouched
//   Home  (H)      2 : 1      (A)  Away                         <- ScoreLine (shared, already updated)
//   [icon] one random comment                                   <- reference style, unchanged
//   Winner: Home                                                <- already caption/secondary, unchanged
//   (A) Kim      (B) Otieno    (C) Amina
//   Arsenal      Draw          Chelsea
//   results  heart  comment   |   Add a comment…                <- footer: real comment box, no border
//
// CHANGES:
//   - the right-half box used to be one big Pressable that opened Chat, with
//     the Input inside it forced non-editable. It's now a real, editable,
//     login-gated comment box — same shape/behavior as MatchCard's — that
//     calls onSubmitComment instead of opening Chat. Tapping the scoreboard
//     still opens Chat, unchanged.
//   - the input's border is suppressed via an override style so it just
//     fades into the card background, and its text is sized down to match
//     the caption style (Input.tsx hard-codes 'body' internally; the
//     override in the `style` prop wins since Input spreads its own style
//     before the passed-in one).
//
// Differences from MatchCard, all because the data is different:
//   - finished games only, so no Live badge, no vote-recorded line, and no
//     "vote first" gating on the comment box — just a login gate

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart, Lock, MessageCircle, Vote } from 'lucide-react-native';
import { FAN_SPACING } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '../modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON, PRESSED_OPACITY } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { ActionButton } from './ui/ActionButton';
import { Input } from './ui/input';
import { ScoreLine } from './ui/Scoreline';
import { VoterList } from './ui/Voterstack';

export interface VoterMini {
    id: string;
    name: string;
    role: 'voted' | 'commented' | 'pledged';
    pick: string;
    pickKind: 'home' | 'away' | 'draw';
}

export interface HistoryComment {
    username: string;
    text: string;
}

export interface HistoryCardData {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    timeAgo: string;
    league?: string;
    people?: VoterMini[];
    voteCount?: number;
    /** Real comments. The preview line shows one at random. */
    comments?: HistoryComment[];
    /** Fallback when only one comment is known. */
    latestComment?: HistoryComment | null;
    commentCount?: number;
    likesCount?: number;
    liked?: boolean;
}

export function HistoryCard({
    data,
    onOpenResults,
    onOpenChat,
    onLike,
    onSubmitComment,
}: {
    data: HistoryCardData;
    onOpenResults?: (id: string) => void;
    onOpenChat?: (id: string) => void;
    onLike?: (id: string) => void;
    onSubmitComment?: (id: string, text: string) => void;
}) {
    const colors = useFanColors();
    const { isLoggedIn } = useAuth();
    const { requireLogin } = useLoginModal();
    const [draft, setDraft] = useState('');
    const {
        id,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        timeAgo,
        league,
        people = [],
        voteCount,
        comments,
        latestComment,
        commentCount,
        likesCount = 0,
        liked = false,
    } = data;

    // Random pick, fixed for this card's lifetime (same rule as MatchCard).
    const [seed] = useState(() => Math.random());
    const pool = comments?.length ? comments : latestComment ? [latestComment] : [];
    const preview = pool.length ? pool[Math.floor(seed * pool.length)] : null;

    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;
    const winnerName = homeWon ? homeTeam : awayWon ? awayTeam : 'Draw';

    const pickColor = (kind: VoterMini['pickKind']) =>
        kind === 'home' ? colors.primary : kind === 'away' ? colors.away : colors.draw;

    function handleSubmit() {
        if (!isLoggedIn) return requireLogin(handleSubmit);
        const text = draft.trim();
        if (!text) return;
        onSubmitComment?.(id, text);
        setDraft('');
    }

    return (
        <FeedItem colors={colors}>
            {/* Meta */}
            <View style={styles.metaRow}>
                {/* League: kept its own size/weight, forced white — same as MatchCard */}
                <Text
                    style={[fanText('competition', colors, '#FFFFFF'), styles.grow]}
                    numberOfLines={1}
                >
                    {league || 'Full time'}
                </Text>
                {/* Date — left untouched */}
                <Text style={fanText('tag', colors, colors.textTertiary)}>{timeAgo}</Text>
            </View>

            {/* Scoreboard: the whole row opens chat */}
            <Pressable
                onPress={() => onOpenChat?.(id)}
                style={({ pressed }) => pressed && { opacity: PRESSED_OPACITY }}
            >
                <ScoreLine
                    colors={colors}
                    crests
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    center={`${homeScore} : ${awayScore}`}
                    homeWon={homeWon}
                    awayWon={awayWon}
                />
            </Pressable>

            {/* One random comment — the reference style */}
            <View style={styles.lineRow}>
                <MessageCircle size={ICON.sm} color={colors.textTertiary} />
                <Text
                    style={[fanText('caption', colors, colors.textSecondary), styles.grow]}
                    numberOfLines={1}
                >
                    {preview
                        ? `${preview.username}: ${preview.text}`
                        : 'No comments on this match yet'}
                </Text>
            </View>

            <Text style={fanText('caption', colors, colors.textSecondary)}>
                Winner: {winnerName}
            </Text>

            {/* Up to 3 real voters: small icon, name, team */}
            <VoterList
                colors={colors}
                emptyLabel="No votes were cast"
                voters={people.slice(0, 3).map((p) => ({
                    id: p.id,
                    name: p.name,
                    team: p.pick,
                    color: pickColor(p.pickKind),
                }))}
                onPress={() => onOpenResults?.(id)}
            />

            {/* Left half: actions. Right half: a real comment box, login-gated. */}
            <View style={styles.bottomRow}>
                <View style={styles.half}>
                    <ActionButton
                        icon={Vote}
                        label="Results"
                        count={voteCount ?? people.length}
                        colors={colors}
                        onPress={() => onOpenResults?.(id)}
                    />
                    <ActionButton
                        icon={Heart}
                        label={liked ? 'Unlike' : 'Like'}
                        count={likesCount}
                        active={liked}
                        activeColor={colors.away}
                        colors={colors}
                        onPress={() => onLike?.(id)}
                    />
                    <ActionButton
                        icon={MessageCircle}
                        label="Comments"
                        count={commentCount ?? pool.length}
                        colors={colors}
                        onPress={() => onOpenChat?.(id)}
                    />
                </View>

                <View style={[styles.half, styles.inputHalf]}>
                    {!isLoggedIn && <Lock size={ICON.sm} color={colors.textTertiary} />}
                    <Input
                        style={[styles.grow, styles.noBorderInput, fanText('caption', colors, colors.textSecondary)]}
                        colors={colors}
                        variant="inline"
                        value={draft}
                        onChangeText={setDraft}
                        editable={isLoggedIn}
                        placeholder={isLoggedIn ? 'Add a comment…' : 'Log in to comment'}
                        onSubmitEditing={handleSubmit}
                        returnKeyType="send"
                    />
                </View>
            </View>
        </FeedItem>
    );
}

const styles = StyleSheet.create({
    grow: { flex: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    lineRow: { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm },
    bottomRow: { flexDirection: 'row', alignItems: 'center' },
    // Two equal columns: the input area starts at the centre and runs right.
    half: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.base },
    inputHalf: { gap: FAN_SPACING.sm },
    // No line/border under the input — just fades into the card background.
    noBorderInput: {
        borderWidth: 0,
        borderBottomWidth: 0,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
    },
});