/* eslint no-undef: "off" */
import { useEffect, useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { checkUser, registerUser } from '@funspot/core';
import { firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth/auth-context';

function toE164(raw: string) {
  let value = raw.trim().replace(/[\s\-().]/g, '');
  if (value.startsWith('+')) return value;
  if (value.startsWith('00')) return '+' + value.slice(2);
  if (value.startsWith('0')) value = value.slice(1);
  return '+254' + value;
}

export default function LoginModal() {
  const auth = useAuth();
  const navigate = useNavigate();
  const recaptcha = useRef<RecaptchaVerifier | null>(null);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { recaptcha.current?.clear(); }, []);
  async function sendCode(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!firebaseAuth) { setError('Firebase is not configured. Add the VITE_FIREBASE_* values from the setup guide.'); return; }
    const e164 = toE164(phone);
    if (!/^\+\d{10,15}$/.test(e164)) { setError('Enter a valid phone number, including country code if outside Kenya.'); return; }
    setBusy(true);
    try {
      recaptcha.current?.clear();
      recaptcha.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', { size: 'invisible' });
      const result = await signInWithPhoneNumber(firebaseAuth, e164, recaptcha.current);
      setConfirmation(result); setVerifiedPhone(e164);
    } catch (e) {
      const code = (e as {code?: string}).code;
      setError(code === 'auth/invalid-phone-number' ? 'Enter a valid phone number.' : code === 'auth/too-many-requests' ? 'Too many attempts. Please wait before trying again.' : code === 'auth/operation-not-allowed' ? 'Phone sign-in is not enabled for this Firebase project.' : 'Could not send the SMS code. Check the number and SMS region policy, then try again.');
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
  async function finishRegistration(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const name = username.trim();
    if (!/^[a-zA-Z]{3,20}$/.test(name)) { setError('Username must be 3–20 letters (a–z).'); return; }
    setBusy(true);
    try {
      const result = await registerUser(name, verifiedPhone);
      if (!result.ok || !result.user?.id || !result.token) throw new Error(result.message ?? 'Registration failed.');
      auth.login(String(result.user.id), name, result.token, verifiedPhone);
      navigate('/', { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Registration failed.'); }
    finally { setBusy(false); }
  }

  return <main className="login-page"><section className="login-card"><a href="/" className="brand">Funspot😂</a><h1>Join the conversation</h1><p className="muted">Sign in with your phone number. Kenya (+254) is the default country.</p>
    {!confirmation ? <form onSubmit={sendCode} className="login-form"><label htmlFor="phone">Phone number</label><div className="phone-input"><span>+254</span><input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7XX XXX XXX" autoComplete="tel" required /></div><button className="button button-wide" disabled={busy}>{busy ? 'Sending code…' : 'Send verification code'}</button><div id="recaptcha-container" /></form> :
      needsUsername ? <form onSubmit={finishRegistration} className="login-form"><label htmlFor="username">Choose a username</label><input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3–20 letters" required /><button className="button button-wide" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button></form> :
      <form onSubmit={verifyCode} className="login-form"><label htmlFor="code">SMS verification code</label><input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" required /><button className="button button-wide" disabled={busy}>{busy ? 'Verifying…' : 'Verify phone'}</button><button type="button" className="text-button" disabled={busy} onClick={() => { setConfirmation(null); setCode(''); recaptcha.current?.clear(); }}>Use a different number</button></form>}
    {error && <p className="error-message" role="alert">{error}</p>}<p className="muted small">If SMS delivery fails, verify that Phone Authentication is enabled and your country is allowed in Firebase Console.</p>
  </section></main>;
}
