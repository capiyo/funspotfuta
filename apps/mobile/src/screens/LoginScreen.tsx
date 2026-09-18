// RN port of the same backend flow as funspot-next/app/login/page.tsx
// (itself ported from lib/modals/login_modal.dart): phone -> check-user ->
// pin-login / set-pin / register. Same API calls, native inputs/buttons
// instead of web form elements.
//
// Design-system pass: this screen previously had real theme bugs from
// the static shim — hardcoded 'white'/'#000'/'#f87171' and a literal
// 'rgba(255,255,255,0.05)' input background that would have been
// invisible in light mode. Now fully on useFanColors()/fanText()/
// FAN_SPACING/FAN_RADIUS.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { checkUser, isUsernameTaken, pinLogin, setPin, registerUser, FanColorPalette, FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

type Step = 'phone' | 'pin' | 'newPin' | 'username';

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export default function LoginScreen() {
  const colors = useFanColors();
  const styles = createStyles(colors);
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performLogin(userId: string, username: string, token: string, phone: string) {
    await login(userId, username, token, { phone });
  }

  async function handlePhoneSubmit() {
    setError(null);
    const e164 = toE164(phoneInput);
    if (e164.replace('+', '').length < 8) {
      setError('Enter a valid phone number');
      return;
    }
    setLoading(true);
    const user = await checkUser(e164);
    setLoading(false);
    setVerifiedPhone(e164);

    if (user && user.has_pin) {
      setExistingUserId(user.id ?? null);
      setStep('pin');
    } else if (user) {
      setExistingUserId(user.id ?? null);
      setStep('newPin');
    } else {
      setExistingUserId(null);
      setStep('newPin');
    }
  }

  async function handlePinLogin() {
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError('Enter a 4-digit PIN');
      return;
    }
    setLoading(true);
    const res = await pinLogin(verifiedPhone, pin);
    setLoading(false);
    if (res.ok && res.token && res.user) {
      await performLogin(res.user.id, res.user.username, res.token, verifiedPhone);
    } else {
      setError(res.message ?? 'Incorrect PIN');
    }
  }

  async function handleSetNewPin() {
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError('Enter a 4-digit PIN');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match');
      return;
    }
    if (existingUserId) {
      setLoading(true);
      const res = await setPin(existingUserId, pin);
      setLoading(false);
      if (res.ok && res.token) {
        await performLogin(existingUserId, res.user?.username ?? 'User', res.token, verifiedPhone);
      } else {
        setError(res.message ?? 'Failed to set PIN');
      }
    } else {
      setStep('username');
    }
  }

  async function handleRegister() {
    setError(null);
    const name = usernameInput.trim();
    if (name.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    setLoading(true);
    const taken = await isUsernameTaken(name);
    if (taken) {
      setLoading(false);
      setError('Username already taken');
      return;
    }
    const res = await registerUser(name, verifiedPhone, pin);
    setLoading(false);
    if (res.ok && res.token && res.user) {
      await performLogin(res.user.id, name, res.token, verifiedPhone);
    } else {
      setError(res.message ?? 'Registration failed');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={[fanText('scoreCompact', colors), { textAlign: 'center', marginBottom: FAN_SPACING.xs }]}>Funspot</Text>
      <Text style={[fanText('body', colors), { textAlign: 'center', marginBottom: FAN_SPACING.xxxl }]}>
        Where Champions Are Crowned
      </Text>

      {step === 'phone' && (
        <View style={styles.form}>
          <Text style={fanText('caption', colors)}>Phone number</Text>
          <TextInput
            value={phoneInput}
            onChangeText={setPhoneInput}
            placeholder="+254 7XX XXX XXX"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            style={[styles.input, fanText('title', colors)]}
          />
          <Pressable style={styles.button} disabled={loading} onPress={handlePhoneSubmit}>
            <Text style={fanText('button', colors)}>{loading ? 'CHECKING…' : 'CONTINUE'}</Text>
          </Pressable>
        </View>
      )}

      {step === 'pin' && (
        <View style={styles.form}>
          <Text style={[fanText('body', colors), { textAlign: 'center' }]}>Enter your 4-digit PIN for {verifiedPhone}</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPinValue(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={[styles.input, styles.pinInput, fanText('scoreDash', colors, colors.textPrimary)]}
          />
          <Pressable style={styles.button} disabled={loading} onPress={handlePinLogin}>
            <Text style={fanText('button', colors)}>{loading ? 'LOGGING IN…' : 'LOG IN'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep('phone')}>
            <Text style={[fanText('caption', colors), { textAlign: 'center' }]}>Use a different number</Text>
          </Pressable>
        </View>
      )}

      {step === 'newPin' && (
        <View style={styles.form}>
          <Text style={[fanText('body', colors), { textAlign: 'center' }]}>
            {existingUserId ? 'Set a 4-digit PIN for your account' : `Create a PIN for ${verifiedPhone}`}
          </Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPinValue(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="New PIN"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={[styles.input, styles.pinInput, fanText('scoreDash', colors, colors.textPrimary)]}
          />
          <TextInput
            value={pinConfirm}
            onChangeText={(t) => setPinConfirm(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="Confirm PIN"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={[styles.input, styles.pinInput, fanText('scoreDash', colors, colors.textPrimary)]}
          />
          <Pressable style={styles.button} disabled={loading} onPress={handleSetNewPin}>
            <Text style={fanText('button', colors)}>{loading ? 'PLEASE WAIT…' : 'CONTINUE'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep('phone')}>
            <Text style={[fanText('caption', colors), { textAlign: 'center' }]}>Use a different number</Text>
          </Pressable>
        </View>
      )}

      {step === 'username' && (
        <View style={styles.form}>
          <Text style={[fanText('body', colors), { textAlign: 'center' }]}>Pick a username</Text>
          <TextInput
            value={usernameInput}
            onChangeText={setUsernameInput}
            placeholder="username"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, fanText('title', colors)]}
          />
          <Pressable style={styles.button} disabled={loading} onPress={handleRegister}>
            <Text style={fanText('button', colors)}>{loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={[fanText('body', colors, colors.away), { textAlign: 'center', marginTop: FAN_SPACING.lg }]}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: FAN_SPACING.xxl },
    form: { gap: FAN_SPACING.base },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputSurface,
      borderRadius: FAN_RADIUS.md,
      paddingHorizontal: FAN_SPACING.lg,
      paddingVertical: FAN_SPACING.base,
    },
    pinInput: { textAlign: 'center', letterSpacing: 12 },
    button: { backgroundColor: colors.primary, borderRadius: FAN_RADIUS.md, paddingVertical: FAN_SPACING.base + 2, alignItems: 'center' },
  });
}
