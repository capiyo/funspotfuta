// apps/mobile/src/modals/ProfileModal/PaymentDialogs.tsx
//
// Deposit (STK push) and Withdraw (B2C) dialogs, ported from the two
// AlertDialogs in funspot/lib/modals/profile/swipeable_profile_modal.dart.
//
// The Flutter source builds these with StatefulBuilder + AlertDialog.
// RN has no direct equivalent, so each is a Modal + internal state.
//
// Both dialogs share the "processing → success/failure" flow from the
// original: the user enters amount + phone, hits submit, sees an inline
// status line while the request is in flight, and the dialog closes on
// success only.

import { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    Modal,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import {
    CheckCircle2,
    AlertCircle,
    Info,
    Wallet,
    Plus,
    Minus,
} from 'lucide-react-native';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import {
    initiateSTKPush,
    initiateB2CPayment,
    savePhone,
} from '@funspot/core';

type FanColors = ReturnType<typeof useFanColors>;

// Matches the Flutter _isValidPhone regex.
function isValidPhone(phone: string): boolean {
    const cleaned = phone.replace(/[^0-9]/g, '');
    return /^(0|254)?[71][0-9]{8}$/.test(cleaned);
}

function hexWithAlpha(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    if (c.length !== 6) return hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════
//  SHARED SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════

function BalanceStrip({
    colors,
    styles,
    balance,
    loading,
}: {
    colors: FanColors;
    styles: ReturnType<typeof createStyles>;
    balance: number;
    loading: boolean;
}) {
    return (
        <View style={styles.balanceStrip}>
            <Wallet size={14} color={colors.primary} />
            <Text style={[styles.balanceStripText, { color: colors.textPrimary }]}>
                {loading ? 'Loading…' : `KES ${balance.toFixed(2)}`}
            </Text>
        </View>
    );
}

function InfoBox({
    colors,
    styles,
    danger,
    text,
}: {
    colors: FanColors;
    styles: ReturnType<typeof createStyles>;
    danger?: boolean;
    text: string;
}) {
    const accent = danger ? colors.away : colors.primary;
    return (
        <View
            style={[
                styles.infoBox,
                { borderColor: hexWithAlpha(accent, 0.15) },
            ]}
        >
            {danger ? (
                <AlertCircle size={12} color={accent} />
            ) : (
                <Info size={12} color={accent} />
            )}
            <Text style={[styles.infoBoxText, { color: accent }]}>{text}</Text>
        </View>
    );
}

function StatusLine({
    colors,
    styles,
    message,
}: {
    colors: FanColors;
    styles: ReturnType<typeof createStyles>;
    message: string;
}) {
    const isSuccess = message.includes('✅');
    const isError = message.includes('❌');
    const accent = isSuccess
        ? colors.primary
        : isError
            ? colors.away
            : colors.primary;

    return (
        <View
            style={[
                styles.statusLine,
                { backgroundColor: hexWithAlpha(accent, 0.08) },
            ]}
        >
            {isSuccess ? (
                <CheckCircle2 size={14} color={accent} />
            ) : isError ? (
                <AlertCircle size={14} color={accent} />
            ) : (
                <ActivityIndicator size="small" color={accent} />
            )}
            <Text style={[styles.statusLineText, { color: accent }]}>{message}</Text>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  DEPOSIT (STK Push)
// ═══════════════════════════════════════════════════════════════

export interface DepositDialogProps {
    visible: boolean;
    userId: string;
    username: string;
    authToken: string | null;
    balance: number;
    isBalanceLoading: boolean;
    savedPhone: string | null;
    onClose: () => void;
    onSuccess: (newBalance: number) => void;
}

export function DepositDialog({
    visible,
    userId,
    username,
    authToken,
    balance,
    isBalanceLoading,
    savedPhone,
    onClose,
    onSuccess,
}: DepositDialogProps) {
    const colors = useFanColors();
    const styles = createStyles(colors);

    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [useSaved, setUseSaved] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (!visible) return;
        setAmount('');
        setPhone(savedPhone ?? '');
        setUseSaved(true);
        setProcessing(false);
        setStatus('');
    }, [visible, savedPhone]);

    async function handlePay() {
        const parsed = parseFloat(amount);
        if (!parsed || parsed <= 0) {
            setStatus('❌ Enter a valid amount');
            return;
        }
        const trimmedPhone = phone.trim();
        if (!trimmedPhone || !isValidPhone(trimmedPhone)) {
            setStatus('❌ Enter a valid phone number');
            return;
        }

        setProcessing(true);
        setStatus('⏳ Processing… Please check your phone');

        try {
            const result = await initiateSTKPush({
                userId,
                username,
                amount: parsed,
                phoneNumber: trimmedPhone,
                authToken: authToken ?? undefined,
                purpose: 'Top up balance',
            });

            if (result.success) {
                setStatus('✅ Payment successful!');
                if (useSaved) {
                    await savePhone(userId, 'topup', trimmedPhone, authToken ?? undefined);
                }
                const newBalance = result.newBalance ?? balance + parsed;
                setTimeout(() => {
                    onSuccess(newBalance);
                    onClose();
                }, 800);
            } else {
                setStatus(`❌ ${result.message ?? 'Payment failed'}`);
                setProcessing(false);
            }
        } catch (e: any) {
            setStatus(`❌ ${e?.message ?? 'Payment failed'}`);
            setProcessing(false);
        }
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={processing ? undefined : onClose}
            statusBarTranslucent
        >
            <Pressable
                style={styles.backdrop}
                onPress={processing ? undefined : onClose}
            >
                <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.dialogHeader}>
                        <Plus size={18} color={colors.primary} />
                        <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
                            Top Up Balance
                        </Text>
                    </View>

                    <BalanceStrip
                        colors={colors}
                        styles={styles}
                        balance={balance}
                        loading={isBalanceLoading}
                    />

                    <View style={processing ? styles.inputsDisabled : undefined}>
                        <TextInput
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="Amount (KES)"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            editable={!processing}
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.border,
                                    backgroundColor: colors.inputSurface,
                                },
                            ]}
                        />

                        <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="M-Pesa Phone Number"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="phone-pad"
                            editable={!processing}
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.border,
                                    backgroundColor: colors.inputSurface,
                                },
                            ]}
                        />

                        <Pressable
                            onPress={() => {
                                const next = !useSaved;
                                setUseSaved(next);
                                if (next && savedPhone) setPhone(savedPhone);
                            }}
                            disabled={processing}
                            style={styles.checkboxRow}
                        >
                            <View
                                style={[
                                    styles.checkbox,
                                    {
                                        borderColor: useSaved ? colors.primary : colors.border,
                                        backgroundColor: useSaved ? colors.primary : 'transparent',
                                    },
                                ]}
                            >
                                {useSaved && <CheckCircle2 size={12} color="#FFFFFF" />}
                            </View>
                            <Text
                                style={[styles.checkboxLabel, { color: colors.textTertiary }]}
                            >
                                Save this number for future top-ups
                            </Text>
                        </Pressable>
                    </View>

                    <InfoBox
                        colors={colors}
                        styles={styles}
                        text="You will receive a prompt to enter your PIN"
                    />

                    {status.length > 0 && (
                        <StatusLine colors={colors} styles={styles} message={status} />
                    )}

                    <View style={styles.dialogActions}>
                        <Pressable
                            onPress={onClose}
                            disabled={processing}
                            style={[styles.dialogBtn, { borderColor: colors.border }]}
                        >
                            <Text
                                style={[styles.dialogBtnText, { color: colors.textSecondary }]}
                            >
                                {processing ? 'Processing…' : 'Cancel'}
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handlePay}
                            disabled={processing}
                            style={[
                                styles.dialogBtn,
                                styles.dialogBtnPrimary,
                                { backgroundColor: colors.primary },
                            ]}
                        >
                            {processing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.dialogBtnPrimaryText}>Pay via M-Pesa</Text>
                            )}
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════
//  WITHDRAW (B2C)
// ═══════════════════════════════════════════════════════════════

export interface WithdrawDialogProps {
    visible: boolean;
    userId: string;
    username: string;
    authToken: string | null;
    balance: number;
    isBalanceLoading: boolean;
    savedPhone: string | null;
    onClose: () => void;
    onSuccess: (newBalance: number) => void;
}

export function WithdrawDialog({
    visible,
    userId,
    username,
    authToken,
    balance,
    isBalanceLoading,
    savedPhone,
    onClose,
    onSuccess,
}: WithdrawDialogProps) {
    const colors = useFanColors();
    const styles = createStyles(colors);

    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [useSaved, setUseSaved] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (!visible) return;
        setAmount('');
        setPhone(savedPhone ?? '');
        setUseSaved(true);
        setProcessing(false);
        setStatus('');
    }, [visible, savedPhone]);

    async function handleWithdraw() {
        const parsed = parseFloat(amount);
        if (!parsed || parsed <= 0) {
            setStatus('❌ Enter a valid amount');
            return;
        }
        if (parsed > balance) {
            setStatus('❌ Insufficient balance');
            return;
        }
        const trimmedPhone = phone.trim();
        if (!trimmedPhone || !isValidPhone(trimmedPhone)) {
            setStatus('❌ Enter a valid phone number');
            return;
        }

        setProcessing(true);
        setStatus('⏳ Processing withdrawal…');

        try {
            const result = await initiateB2CPayment({
                userId,
                username,
                // The Flutter source sends the literal string 'user_withdrawal'
                // here — it's not a real channel, just a discriminator the
                // backend uses to route the payout.
                channelId: 'user_withdrawal',
                amount: parsed,
                phoneNumber: trimmedPhone,
                authToken: authToken ?? undefined,
                remarks: 'User withdrawal',
                occasion: 'User Withdrawal',
            });

            if (result.success) {
                setStatus('✅ Withdrawal submitted');
                if (useSaved) {
                    await savePhone(userId, 'withdraw', trimmedPhone, authToken ?? undefined);
                }
                const newBalance = result.newBalance ?? balance - parsed;
                setTimeout(() => {
                    onSuccess(newBalance);
                    onClose();
                }, 800);
            } else {
                setStatus(`❌ ${result.message ?? 'Withdrawal failed'}`);
                setProcessing(false);
            }
        } catch (e: any) {
            setStatus(`❌ ${e?.message ?? 'Withdrawal failed'}`);
            setProcessing(false);
        }
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={processing ? undefined : onClose}
            statusBarTranslucent
        >
            <Pressable
                style={styles.backdrop}
                onPress={processing ? undefined : onClose}
            >
                <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.dialogHeader}>
                        <Minus size={18} color={colors.away} />
                        <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
                            Withdraw Funds
                        </Text>
                    </View>

                    <BalanceStrip
                        colors={colors}
                        styles={styles}
                        balance={balance}
                        loading={isBalanceLoading}
                    />

                    <View style={processing ? styles.inputsDisabled : undefined}>
                        <TextInput
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="Amount (KES)"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                            editable={!processing}
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.border,
                                    backgroundColor: colors.inputSurface,
                                },
                            ]}
                        />

                        <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="M-Pesa Phone Number"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="phone-pad"
                            editable={!processing}
                            style={[
                                styles.input,
                                {
                                    color: colors.textPrimary,
                                    borderColor: colors.border,
                                    backgroundColor: colors.inputSurface,
                                },
                            ]}
                        />

                        <Pressable
                            onPress={() => {
                                const next = !useSaved;
                                setUseSaved(next);
                                if (next && savedPhone) setPhone(savedPhone);
                            }}
                            disabled={processing}
                            style={styles.checkboxRow}
                        >
                            <View
                                style={[
                                    styles.checkbox,
                                    {
                                        borderColor: useSaved ? colors.primary : colors.border,
                                        backgroundColor: useSaved ? colors.primary : 'transparent',
                                    },
                                ]}
                            >
                                {useSaved && <CheckCircle2 size={12} color="#FFFFFF" />}
                            </View>
                            <Text
                                style={[styles.checkboxLabel, { color: colors.textTertiary }]}
                            >
                                Save this number for future withdrawals
                            </Text>
                        </Pressable>
                    </View>

                    <InfoBox
                        colors={colors}
                        styles={styles}
                        danger
                        text="Withdrawals are processed within 24 hours"
                    />

                    {status.length > 0 && (
                        <StatusLine colors={colors} styles={styles} message={status} />
                    )}

                    <View style={styles.dialogActions}>
                        <Pressable
                            onPress={onClose}
                            disabled={processing}
                            style={[styles.dialogBtn, { borderColor: colors.border }]}
                        >
                            <Text
                                style={[styles.dialogBtnText, { color: colors.textSecondary }]}
                            >
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleWithdraw}
                            disabled={processing}
                            style={[
                                styles.dialogBtn,
                                styles.dialogBtnPrimary,
                                { backgroundColor: colors.away },
                            ]}
                        >
                            {processing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.dialogBtnPrimaryText}>Withdraw</Text>
                            )}
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

function createStyles(colors: FanColors) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: FAN_SPACING.lg,
        },
        dialog: {
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: FAN_RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: FAN_SPACING.lg,
        },
        dialogHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            marginBottom: FAN_SPACING.base,
        },
        dialogTitle: { fontSize: 15, fontWeight: '700' },

        balanceStrip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            paddingHorizontal: FAN_SPACING.base,
            paddingVertical: FAN_SPACING.md,
            backgroundColor: colors.surfaceSunken,
            borderRadius: FAN_RADIUS.md,
            marginBottom: FAN_SPACING.base,
        },
        balanceStripText: { fontSize: 12, fontWeight: '600' },

        inputsDisabled: { opacity: 0.5 },
        input: {
            borderWidth: 1,
            borderRadius: FAN_RADIUS.md,
            paddingHorizontal: FAN_SPACING.base,
            paddingVertical: FAN_SPACING.md,
            fontSize: 13,
            marginBottom: FAN_SPACING.md,
        },
        checkboxRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            marginBottom: FAN_SPACING.md,
        },
        checkbox: {
            width: 18,
            height: 18,
            borderRadius: FAN_RADIUS.sm,
            borderWidth: 1.5,
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkboxLabel: { fontSize: 11, flex: 1 },

        infoBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            padding: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.sm,
            borderWidth: 0.5,
            backgroundColor: colors.surfaceSunken,
        },
        infoBoxText: { fontSize: 9, flex: 1 },

        statusLine: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            padding: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.sm,
            marginTop: FAN_SPACING.md,
        },
        statusLineText: { fontSize: 11, flex: 1 },

        dialogActions: {
            flexDirection: 'row',
            gap: FAN_SPACING.md,
            marginTop: FAN_SPACING.lg,
        },
        dialogBtn: {
            flex: 1,
            height: 44,
            borderRadius: FAN_RADIUS.pill,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'transparent',
        },
        dialogBtnText: { fontSize: 13, fontWeight: '600' },
        dialogBtnPrimary: { borderWidth: 0 },
        dialogBtnPrimaryText: {
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '700',
        },
    });
}