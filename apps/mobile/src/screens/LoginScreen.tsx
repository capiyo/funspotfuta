// RN port of the same backend flow as funspot-next/app/login/page.tsx
// (itself ported from lib/modals/login_modal.dart): phone -> check-user ->
// pin-login / set-pin / register. Same API calls, native inputs/buttons
// instead of web form elements.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { checkUser, isUsernameTaken, pinLogin, setPin, registerUser } from '@funspot/core';
import { colors } from '@/theme';

type Step = 'phone' | 'pin' | 'newPin' | 'username';

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export default function LoginScreen() {
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
      <Text style={styles.title}>Funspot</Text>
      <Text style={styles.subtitle}>Where Champions Are Crowned</Text>

      {step === 'phone' && (
        <View style={styles.form}>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            value={phoneInput}
            onChangeText={setPhoneInput}
            placeholder="+254 7XX XXX XXX"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Pressable style={styles.button} disabled={loading} onPress={handlePhoneSubmit}>
            <Text style={styles.buttonText}>{loading ? 'Checking…' : 'Continue'}</Text>
          </Pressable>
        </View>
      )}

      {step === 'pin' && (
        <View style={styles.form}>
          <Text style={styles.helper}>Enter your 4-digit PIN for {verifiedPhone}</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPinValue(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={[styles.input, styles.pinInput]}
          />
          <Pressable style={styles.button} disabled={loading} onPress={handlePinLogin}>
            <Text style={styles.buttonText}>{loading ? 'Logging in…' : 'Log In'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep('phone')}>
            <Text style={styles.linkText}>Use a different number</Text>
          </Pressable>
        </View>
      )}

      {step === 'newPin' && (
        <View style={styles.form}>
          <Text style={styles.helper}>
            {existingUserId ? 'Set a 4-digit PIN for your account' : `Create a PIN for ${verifiedPhone}`}
          </Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPinValue(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="New PIN"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={[styles.input, styles.pinInput]}
          />
          <TextInput
            value={pinConfirm}
            onChangeText={(t) => setPinConfirm(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="Confirm PIN"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={[styles.input, styles.pinInput]}
          />
          <Pressable style={styles.button} disabled={loading} onPress={handleSetNewPin}>
            <Text style={styles.buttonText}>{loading ? 'Please wait…' : 'Continue'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep('phone')}>
            <Text style={styles.linkText}>Use a different number</Text>
          </Pressable>
        </View>
      )}

      {step === 'username' && (
        <View style={styles.form}>
          <Text style={styles.helper}>Pick a username</Text>
          <TextInput
            value={usernameInput}
            onChangeText={setUsernameInput}
            placeholder="username"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Pressable style={styles.button} disabled={loading} onPress={handleRegister}>
            <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 24 },
  title: { color: 'white', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 32 },
  form: { gap: 12 },
  label: { color: colors.textSecondary, fontSize: 12 },
  helper: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'white',
    fontSize: 15,
  },
  pinInput: { textAlign: 'center', fontSize: 24, letterSpacing: 12 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 15 },
  linkText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center', marginTop: 16 },
});
