'use client';

// Ported from funspot/lib/modals/login_modal.dart's backend-driven PIN flow:
//   1. enter phone -> check-user
//   2a. existing user with a PIN -> pin-login
//   2b. existing user without a PIN -> set-pin
//   2c. new number -> pick a username -> register
// The original also offers Firebase Phone-Auth OTP verification as an
// alternative first step for brand-new numbers (see
// lib/services/firebase_auth_service.dart) — that needs the project's live
// Firebase reCAPTCHA/SMS setup, so it's flagged in the README as follow-up
// rather than stubbed here.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { checkUser, isUsernameTaken, pinLogin, setPin, registerUser } from '@funspot/core';

type Step = 'phone' | 'pin' | 'newPin' | 'username';

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function performLogin(userId: string, username: string, token: string, phone: string) {
    await login(userId, username, token, { phone });
    router.replace('/home');
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
      // Exists but no PIN yet
      setExistingUserId(user.id ?? null);
      setStep('newPin');
    } else {
      // Brand new number
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
      setInfo(`Welcome back, ${res.user.username}! 🎉`);
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
        const uname = res.user?.username ?? 'User';
        await performLogin(existingUserId, uname, res.token, verifiedPhone);
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
      setInfo(`Welcome to Funspot, ${name}! 🎉`);
      await performLogin(res.user.id, name, res.token, verifiedPhone);
    } else {
      setError(res.message ?? 'Registration failed');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-fan-background px-fan-xxl">
      <div className="w-full max-w-sm">
        <h1 className="mb-fan-sm text-center font-condensed text-fan-headline text-fan-textPrimary">Funspot</h1>
        <p className="mb-fan-xxxl text-center text-fan-body text-fan-textTertiary">Where Champions Are Crowned</p>

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
            <button
              onClick={handlePhoneSubmit}
              disabled={loading}
              className="w-full rounded-fan-lg bg-fan-primary py-fan-base font-semibold text-fan-textInverse disabled:opacity-60"
            >
              {loading ? 'Checking…' : 'Continue'}
            </button>
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
