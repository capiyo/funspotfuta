/* eslint no-undef: "off" */
import { useEffect, useRef, useState } from 'react';
import { buildE164, validatePhone, validateUsername } from '@/lib/auth/auth-validation';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { checkUser, pinLogin, registerUser, setPin } from '@funspot/core';
import { firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth/auth-context';

export default function LoginModal() {
  const auth = useAuth();
  const navigate = useNavigate();
  const recaptcha = useRef<RecaptchaVerifier | null>(null);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+254');
  const [resendIn, setResendIn] = useState(0);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [isNewPinUser, setIsNewPinUser] = useState(false);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { recaptcha.current?.clear(); }, []);
  useEffect(() => { if (resendIn <= 0) return; const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000); return () => window.clearTimeout(timer); }, [resendIn]);
  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault(); setError('');
    if (!firebaseAuth) { setError('Firebase is not configured. Add the VITE_FIREBASE_* values from the setup guide.'); return; }
    const phoneError = validatePhone(phone, countryCode);
    if (phoneError) { setError(phoneError); return; }
    if (!acceptTerms) { setError('Please accept Terms & Conditions'); return; }
    const e164 = buildE164(phone, countryCode);
    setBusy(true);
    try {
      recaptcha.current?.clear();
      recaptcha.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', { size: 'invisible' });
      const result = await signInWithPhoneNumber(firebaseAuth, e164, recaptcha.current);
      setConfirmation(result); setVerifiedPhone(e164); setResendIn(30);
    } catch (e) {
      const code = (e as {code?: string}).code;
      if (code === 'auth/invalid-phone-number') setError('Enter a valid phone number.');
      else if (code === 'auth/too-many-requests') setError('Too many attempts. Please wait before trying again.');
      else if (code === 'auth/operation-not-allowed') setError('Phone sign-in is not enabled for this Firebase project.');
      else {
        const existing = await checkUser(e164).catch(() => null);
        setExistingUserId(existing?.id ? String(existing.id) : null);
        setIsNewPinUser(existing?.has_pin !== true);
        setNeedsPin(true);
        setPinValue(''); setPinConfirm('');
        setError('SMS could not be sent. Continue with your 4-digit PIN, or set one if this is your first sign-in.');
      }
    } finally { setBusy(false); }
  }
  async function verifyCode(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!confirmation) return;
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit SMS code.'); return; }
    setBusy(true);
    try {
      const credential = await confirmation.confirm(code.trim());
      const firebaseUser = credential.user;
      const idToken = await firebaseUser.getIdToken(true);
      const existing = await checkUser(verifiedPhone);
      if (existing?.id) {
        auth.login(String(existing.id), String(existing.username ?? 'Fan'), idToken, verifiedPhone);
        navigate('/', { replace: true });
      } else {
        setNeedsUsername(true);
      }
    } catch (e) {
      const code = (e as {code?: string}).code;
      setError(code === 'auth/invalid-verification-code' ? 'That code is incorrect.' : code === 'auth/code-expired' ? 'That code has expired. Request a new one.' : 'Could not verify the code. Please try again.');
    } finally { setBusy(false); }
  }
  async function submitPin(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!/^\d{4}$/.test(pin.trim())) { setError('Enter a 4-digit PIN'); return; }
    if (isNewPinUser && pin.trim() !== pinConfirm.trim()) { setError('PINs do not match'); return; }
    setBusy(true);
    try {
      if (isNewPinUser && existingUserId) {
        const result = await setPin(existingUserId, pin.trim());
        if (result.ok && result.token) { auth.login(existingUserId, result.user?.username ?? 'User', result.token, verifiedPhone); navigate('/', { replace: true }); return; }
        setError(result.message ?? 'Failed to set PIN'); return;
      }
      if (isNewPinUser && !existingUserId) {
        setPendingPin(pin.trim()); setNeedsPin(false); setNeedsUsername(true); return;
      }
      const result = await pinLogin(verifiedPhone, pin.trim());
      if (result.ok && result.token && result.user) { auth.login(String(result.user.id), result.user.username ?? 'User', result.token, verifiedPhone); navigate('/', { replace: true }); return; }
      setError(result.message ?? 'Incorrect PIN');
    } catch (e) { setError(e instanceof Error ? e.message : 'PIN sign-in failed.'); }
    finally { setBusy(false); }
  }

  async function finishRegistration(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const name = username.trim();
    const validationError = validateUsername(name);
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    try {
      const result = await registerUser(name, verifiedPhone, pendingPin ?? undefined);
      if (!result.ok || !result.user?.id || !result.token) throw new Error(result.message ?? 'Registration failed.');
      auth.login(String(result.user.id), name, result.token, verifiedPhone);
      navigate('/', { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Registration failed.'); }
    finally { setBusy(false); }
  }

  return <main className="login-page"><section className="login-card"><a href="/" className="brand">Funspot😂</a><h1>Join the conversation</h1><p className="muted">Sign in with your phone number. Kenya (+254) is the default country.</p>
    {needsPin ? <form onSubmit={submitPin} className="login-form"><p className="muted">SMS verification is unavailable. Continue with your account PIN or set one.</p><label htmlFor="pin">4-digit PIN</label><input id="pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))} required />{isNewPinUser && <><label htmlFor="pin-confirm">Confirm PIN</label><input id="pin-confirm" type="password" inputMode="numeric" maxLength={4} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} required /></>}<button className="button button-wide" disabled={busy}>{busy ? 'Please wait…' : isNewPinUser ? 'Set PIN' : 'Sign in with PIN'}</button><button type="button" className="text-button" onClick={() => { setNeedsPin(false); setError(''); }}>Back to phone</button></form> :
      
      needsUsername ? <form onSubmit={finishRegistration} className="login-form"><label htmlFor="username">Choose a username</label><input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3–20 letters" required /><button className="button button-wide" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button></form> :  !confirmation ? <form onSubmit={sendCode} className="login-form"><label htmlFor="country-code">Country</label><select id="country-code" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>{[['Kenya','+254'],['United States','+1'],['United Kingdom','+44'],['Nigeria','+234'],['Ghana','+233'],['South Africa','+27'],['Tanzania','+255'],['Uganda','+256'],['Rwanda','+250'],['Ethiopia','+251'],['India','+91'],['Canada','+1'],['Australia','+61'],['Germany','+49'],['Netherlands','+31']].map(([name,dial]) => <option key={name} value={dial}>{name} ({dial})</option>)}</select><label htmlFor="phone">Phone number</label><div className="phone-input"><span>{countryCode}</span><input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={countryCode === '+254' ? '7XX XXX XXX' : 'Phone number'} autoComplete="tel" required /></div><label className="terms-row"><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} /> I accept the <a href="https://clash-privacy.netlify.app/" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>.</label><button className="button button-wide" disabled={busy}>{busy ? 'Sending code…' : 'Send verification code'}</button><div id="recaptcha-container" /></form> :
      
      <form onSubmit={verifyCode} className="login-form"><label htmlFor="code">SMS verification code</label><input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" required /><button className="button button-wide" disabled={busy}>{busy ? 'Verifying…' : 'Verify phone'}</button><button type="button" className="text-button" disabled={busy || resendIn > 0} onClick={() => { setConfirmation(null); setCode(''); void sendCode(); }}>{resendIn > 0 ? 'Resend code in ' + resendIn + 's' : 'Resend code'}</button><button type="button" className="text-button" disabled={busy} onClick={() => { setConfirmation(null); setCode(''); setError(''); recaptcha.current?.clear(); }}>Use a different number</button></form>}
    {error && <p className="error-message" role="alert">{error}</p>}<p className="muted small">If SMS delivery fails, verify that Phone Authentication is enabled and your country is allowed in Firebase Console.</p>
  </section></main>;
}
