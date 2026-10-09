// apps/web/components/LoginModal.tsx
'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, signOut, type ConfirmationResult } from 'firebase/auth';
import { checkUser, isUsernameTaken, pinLogin, setPin, registerUser, registerToken } from '@funspot/core';
import { requestFcmToken } from '@/lib/firebase';

type Step = 'phone' | 'otp' | 'pin' | 'newPin' | 'username';

function toE164(raw: string): string {
  const cleaned = raw.trim().replace(/[\s().-]/g, '');
  if (cleaned.startsWith('+')) return `+${cleaned.slice(1).replace(/\D/g, '')}`;

  const digits = cleaned.replace(/\D/g, '');
  // Match the mobile app's Kenya-first phone entry for common local formats.
  // Explicit international numbers can always be entered with a leading +.
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  return `+${digits}`;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (userId: string, username: string) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [otp, setOtp] = useState('');
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setStep('phone');
    setPhoneInput('');
    setVerifiedPhone('');
    setExistingUserId(null);
    setConfirmation(null);
    setOtp('');
    setPendingPin(null);
    setAcceptTerms(false);
    setPinValue('');
    setPinConfirm('');
    setUsernameInput('');
    setError(null);
    setInfo(null);
    try { recaptchaRef.current?.clear(); } catch { /* verifier may already be cleared */ }
    recaptchaRef.current = null;
    onClose();
  }

  async function performLogin(userId: string, username: string, token: string, phone: string) {
    const saved = await login(userId, username, token, { phone });
    if (!saved) {
      setError('Login failed. Please try again.');
      return;
    }
    try {
      const fcmToken = await requestFcmToken();
      if (fcmToken) await registerToken({ userId, fcmToken, platform: 'web', authToken: token });
    } catch (notificationError) {
      // Notification permission/configuration must not block a successful login.
      console.warn('Web push registration was skipped:', notificationError);
    }
    onLoginSuccess?.(userId, username);
    resetAndClose();
  }

  async function switchToPinFlow(e164: string) {
    setVerifiedPhone(e164);
    setConfirmation(null);
    setOtp('');
    try {
      const user = await checkUser(e164);
      if (user && user.has_pin) {
        setExistingUserId(user.id ?? null);
        setStep('pin');
      } else {
        setExistingUserId(user?.id ?? null);
        setStep('newPin');
      }
    } catch {
      setError('Could not check this number. Please try again.');
      setStep('phone');
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneSubmit() {
    setError(null);
    const e164 = toE164(phoneInput);
    if (e164.replace('+', '').length < 8) {
      setError('Enter a valid phone number');
      return;
    }
    if (!acceptTerms) {
      setError('Please accept the Terms & Conditions to continue');
      return;
    }
    setLoading(true);
    setVerifiedPhone(e164);
    try {
      try { await signOut(auth); } catch { /* no prior Firebase session */ }
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(auth, 'web-phone-recaptcha', { size: 'invisible' });
      const result = await signInWithPhoneNumber(auth, e164, recaptchaRef.current);
      setConfirmation(result);
      setOtp('');
      setStep('otp');
      setInfo(`Verification code sent to ${e164}`);
    } catch (firebaseError) {
      console.warn('Firebase phone verification unavailable; using PIN fallback.', firebaseError);
      await switchToPinFlow(e164);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit verification code');
      return;
    }
    if (!confirmation) {
      setError('Verification expired. Send a new code.');
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const credential = await confirmation.confirm(otp);
      const firebaseUser = credential.user;
      const token = await firebaseUser.getIdToken();
      const phone = firebaseUser.phoneNumber ?? verifiedPhone;
      const user = await checkUser(phone);
      if (user) {
        await performLogin(user.id ?? '', user.username ?? 'User', token, phone);
      } else {
        setPendingPin(null);
        setStep('username');
      }
    } catch (verificationError) {
      console.error('Phone OTP verification failed:', verificationError);
      setError('Verification failed. Check the code or return to phone entry to try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePinLogin() {
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError('Enter a 4-digit PIN');
      return;
    }
    setLoading(true);
    try {
      const res = await pinLogin(verifiedPhone, pin);
      if (res.ok && res.token && res.user) {
        setInfo(`Welcome back, ${res.user.username}! 🎉`);
        await performLogin(res.user.id, res.user.username, res.token, verifiedPhone);
      } else {
        setError(res.message ?? 'Incorrect PIN');
      }
    } catch (error) {
      console.error('PIN login failed:', error);
      setError('Could not log in. Please check your connection and try again.');
    } finally {
      setLoading(false);
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
    if (!existingUserId) {
      setPendingPin(pin);
      setStep('username');
      return;
    }
    setLoading(true);
    try {
      const res = await setPin(existingUserId, pin);
      if (res.ok && res.token) {
        const uname = res.user?.username ?? 'User';
        await performLogin(existingUserId, uname, res.token, verifiedPhone);
      } else {
        setError(res.message ?? 'Failed to set PIN');
      }
    } catch (error) {
      console.error('Set PIN failed:', error);
      setError('Could not save your PIN. Please try again.');
    } finally {
      setLoading(false);
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
    try {
      const taken = await isUsernameTaken(name);
      if (taken) {
        setError('Username already taken');
        return;
      }
      const res = await registerUser(name, verifiedPhone, pendingPin ?? undefined);
      if (res.ok && res.token && res.user) {
        setInfo(`Welcome to Funspot, ${name}! 🎉`);
        await performLogin(res.user.id, name, res.token, verifiedPhone);
      } else {
        setError(res.message ?? 'Registration failed');
      }
    } catch (error) {
      console.error('Account registration failed:', error);
      setError('Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={resetAndClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-fan-xl bg-fan-background px-fan-xxl pb-fan-xxl pt-fan-lg sm:rounded-fan-xl"
      >
        <div className="mx-auto mb-fan-lg h-1 w-10 rounded-full bg-fan-border sm:hidden" />

        <h1 className="mb-fan-sm text-center font-condensed text-fan-headline text-fan-textPrimary">Funspot</h1>
        <p className="mb-fan-xxxl text-center text-fan-body text-fan-textTertiary">Where Champions Are Crowned</p>

        <div id="web-phone-recaptcha" />
        {step === 'phone' && (
          <div className="space-y-3">
            <label className="block text-fan-caption text-fan-textTertiary">Phone number</label>
            <input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+254 7XX XXX XXX"
              inputMode="tel"
              className="w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken px-fan-lg py-fan-base text-fan-textPrimary outline-none focus:border-fan-primary"
            />
            <label className="flex items-start gap-2 text-fan-caption text-fan-textTertiary"><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5" /> I accept the Terms & Conditions.</label>
            <button
              onClick={handlePhoneSubmit}
              disabled={loading}
              className="w-full rounded-fan-lg bg-fan-primary py-fan-base font-semibold text-fan-textInverse disabled:opacity-60"
            >
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-3">
            <p className="text-center text-fan-body text-fan-textTertiary">Enter the verification code sent to {verifiedPhone}</p>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" inputMode="numeric" maxLength={6} className="w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken px-fan-lg py-fan-base text-center text-2xl tracking-[0.5em] text-fan-textPrimary outline-none focus:border-fan-primary" />
            <button onClick={handleVerifyOtp} disabled={loading} className="w-full rounded-fan-lg bg-fan-primary py-fan-base font-semibold text-fan-textInverse disabled:opacity-60">{loading ? 'Verifying…' : 'Verify phone'}</button>
            <button onClick={() => { setStep('phone'); setConfirmation(null); setError(null); }} className="w-full text-center text-fan-caption text-fan-textTertiary">Use a different number</button>
          </div>
        )}

        {step === 'pin' && (
          <div className="space-y-3">
            <p className="text-center text-fan-body text-fan-textTertiary">Enter your 4-digit PIN for {verifiedPhone}</p>
            <input
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              inputMode="numeric"
              maxLength={4}
              className="w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken px-fan-lg py-fan-base text-center text-2xl tracking-[1em] text-fan-textPrimary outline-none focus:border-fan-primary"
            />
            <button
              onClick={handlePinLogin}
              disabled={loading}
              className="w-full rounded-fan-lg bg-fan-primary py-fan-base font-semibold text-fan-textInverse disabled:opacity-60"
            >
              {loading ? 'Logging in…' : 'Log In'}
            </button>
            <button onClick={() => setStep('phone')} className="w-full text-center text-fan-caption text-fan-textTertiary">
              Use a different number
            </button>
          </div>
        )}

        {step === 'newPin' && (
          <div className="space-y-3">
            <p className="text-center text-fan-body text-fan-textTertiary">
              {existingUserId ? 'Set a 4-digit PIN for your account' : `Create a PIN for ${verifiedPhone}`}
            </p>
            <input
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="New PIN"
              inputMode="numeric"
              maxLength={4}
              className="w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken px-fan-lg py-fan-base text-center text-2xl tracking-[1em] text-fan-textPrimary outline-none focus:border-fan-primary"
            />
            <input
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Confirm PIN"
              inputMode="numeric"
              maxLength={4}
              className="w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken px-fan-lg py-fan-base text-center text-2xl tracking-[1em] text-fan-textPrimary outline-none focus:border-fan-primary"
            />
            <button
              onClick={handleSetNewPin}
              disabled={loading}
              className="w-full rounded-fan-lg bg-fan-primary py-fan-base font-semibold text-fan-textInverse disabled:opacity-60"
            >
              {loading ? 'Please wait…' : 'Continue'}
            </button>
            <button onClick={() => setStep('phone')} className="w-full text-center text-fan-caption text-fan-textTertiary">
              Use a different number
            </button>
          </div>
        )}

        {step === 'username' && (
          <div className="space-y-3">
            <p className="text-center text-fan-body text-fan-textTertiary">Pick a username</p>
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="username"
              className="w-full rounded-fan-lg border border-fan-border bg-fan-surfaceSunken px-fan-lg py-fan-base text-fan-textPrimary outline-none focus:border-fan-primary"
            />
            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full rounded-fan-lg bg-fan-primary py-fan-base font-semibold text-fan-textInverse disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </div>
        )}

        {error && <p className="mt-fan-lg text-center text-fan-body text-fan-away">{error}</p>}
        {info && <p className="mt-fan-lg text-center text-fan-body text-fan-primary">{info}</p>}
      </div>
    </div>
  );
}