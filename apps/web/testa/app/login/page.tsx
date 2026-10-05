// apps/web/components/LoginModal.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { checkUser, isUsernameTaken, pinLogin, setPin, registerUser } from '@funspot/core';

type Step = 'phone' | 'pin' | 'newPin' | 'username';

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (userId: string, username: string) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
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
  const [info, setInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setStep('phone');
    setPhoneInput('');
    setVerifiedPhone('');
    setExistingUserId(null);
    setPinValue('');
    setPinConfirm('');
    setUsernameInput('');
    setError(null);
    setInfo(null);
    onClose();
  }

  async function performLogin(userId: string, username: string, token: string, phone: string) {
    await login(userId, username, token, { phone });
    onLoginSuccess?.(userId, username);
    resetAndClose();
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