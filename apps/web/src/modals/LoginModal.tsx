/* eslint no-undef: "off" */
/** Browser port of apps/mobile/src/modals/LoginModal.tsx. Auth services remain unchanged. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, signOut, type ConfirmationResult, type User as FirebaseUser } from 'firebase/auth';
import { checkUser, isUsernameTaken, pinLogin, setPin, registerUser } from '@funspot/core';
import { firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth/auth-context';
import { buildE164, validatePhone, validateUsername, validatePin } from '@/lib/auth/auth-validation';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

type Step = 'phone' | 'otp' | 'pin' | 'username';
type ToastKind = 'success' | 'warn' | 'error';
type Country = { name: string; iso2: string; dial: string };
type LoginModalProps = { visible?: boolean; onClose?: () => void;
  onSuccess?: (userId: string, username: string) => void };
  const TERMS_URL = 'https://clash-privacy.netlify.app/';
  const COUNTRIES: Country[] = [
  { name: 'Kenya', iso2: 'KE', dial: '+254' }, { name: 'United States', iso2: 'US', dial: '+1' },
  { name: 'United Kingdom', iso2: 'GB', dial: '+44' }, { name: 'Nigeria', iso2: 'NG', dial: '+234' },
  { name: 'Ghana', iso2: 'GH', dial: '+233' }, { name: 'South Africa', iso2: 'ZA', dial: '+27' },
  { name: 'Tanzania', iso2: 'TZ', dial: '+255' }, { name: 'Uganda', iso2: 'UG', dial: '+256' },
  { name: 'Rwanda', iso2: 'RW', dial: '+250' }, { name: 'Ethiopia', iso2: 'ET', dial: '+251' },
  { name: 'Egypt', iso2: 'EG', dial: '+20' }, { name: 'India', iso2: 'IN', dial: '+91' },
  { name: 'Pakistan', iso2: 'PK', dial: '+92' }, { name: 'Canada', iso2: 'CA', dial: '+1' },
  { name: 'Australia', iso2: 'AU', dial: '+61' }, { name: 'Germany', iso2: 'DE', dial: '+49' },
  { name: 'France', iso2: 'FR', dial: '+33' }, { name: 'Spain', iso2: 'ES', dial: '+34' },
  { name: 'Italy', iso2: 'IT', dial: '+39' }, { name: 'Netherlands', iso2: 'NL', dial: '+31' },
  { name: 'UAE', iso2: 'AE', dial: '+971' }, { name: 'Saudi Arabia', iso2: 'SA', dial: '+966' },
  { name: 'China', iso2: 'CN', dial: '+86' }, { name: 'Brazil', iso2: 'BR', dial: '+55' },
  { name: 'Mexico', iso2: 'MX', dial: '+52' }, { name: 'Zambia', iso2: 'ZM', dial: '+260' },
  { name: 'Zimbabwe', iso2: 'ZW', dial: '+263' }, { name: 'Malawi', iso2: 'MW', dial: '+265' },
  { name: 'Somalia', iso2: 'SO', dial: '+252' }, { name: 'DR Congo', iso2: 'CD', dial: '+243' },
];
  const DEFAULT_COUNTRY = COUNTRIES[0];
  const sanitizePhoneInput = (raw: string) => raw.replace(/[^\d\s\-().+]/g, '');
  const sanitizePinInput = (raw: string) => raw.replace(/\D/g, '').slice(0, 4);
  const sanitizeOtpInput = (raw: string) => raw.replace(/\D/g, '').slice(0, 6);
  const sanitizeUsernameInput = (raw: string) => raw.replace(/[^a-zA-Z]/g, '');
  const errorMessage = (error: unknown) => String((error as { message?: unknown })?.message ?? error);
function isoToFlagEmoji(iso2: string) {
  return iso2.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}
function isNetworkError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return ['network-request-failed', 'network request failed', 'socketexception', 'failed host lookup', 'connection refused', 'timeoutexception', 'handshakeexception'].some((part) => message.includes(part));
}
function withStatus(message: string, status?: number) { return status ? `${message} (status ${status})` : message; }

/** Escape closes the existing LoginModalProvider shell; Tab remains inside each dialog. */
function useDialogFocus(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
  const prior = document.activeElement as HTMLElement | null;
  const root = ref.current;
  const items = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]') ?? []);
  const frame = window.requestAnimationFrame(() => items()[0]?.focus());
  const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault();
  close();
  return; }
      if (event.key !== 'Tab') return;
  const all = items();
  if (!all.length) event.preventDefault();
  else if (event.shiftKey && document.activeElement === all[0]) { event.preventDefault(); all[all.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === all[all.length - 1]) { event.preventDefault(); all[0].focus(); }
    };
  document.addEventListener('keydown', keydown);
  return () => { window.cancelAnimationFrame(frame);
  document.removeEventListener('keydown', keydown); prior?.focus(); };
  }, [open, ref, close]);
}

export default function LoginModal({ visible = true, onClose, onSuccess }: LoginModalProps = {}) {
  const { login } = useAuth();
  const colors = useFanColors();
  const dialogRef = useRef<HTMLDivElement>(null);
  const countryDialogRef = useRef<HTMLDivElement>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const otpHandledRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [isNewPinUser, setIsNewPinUser] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinObscure, setPinObscure] = useState(true);
  const [pinConfirmObscure, setPinConfirmObscure] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [toastState, setToastState] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
  const query = countrySearch.trim().toLowerCase();
  return COUNTRIES.filter((item) => item.name.toLowerCase().includes(query) || item.dial.includes(query) || item.iso2.toLowerCase() === query);
  }, [countrySearch]);
  const closeDialog = useCallback(() => {
    if (onClose) onClose();
  else document.querySelector<HTMLButtonElement>('.login-modal-backdrop')?.click();
  }, [onClose]);
  useDialogFocus(visible, dialogRef, closeDialog);
  useDialogFocus(pickerVisible, countryDialogRef, () => setPickerVisible(false));

  // A single verifier is retained while mounted; its container never changes between sends.
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    recaptchaVerifier.current?.clear();
    recaptchaVerifier.current = null;
  }, []);
  useEffect(() => {
    if (resendSeconds <= 0) return;
  const timer = window.setTimeout(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
  return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function toast(message: string, options?: { error?: boolean; warn?: boolean }) {
    const kind: ToastKind = options?.error ? 'error' : options?.warn ? 'warn' : 'success';
  if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ msg: message, kind });
    toastTimer.current = setTimeout(() => setToastState(null), (kind === 'error' ? 7 : kind === 'warn' ? 4 : 3) * 1000);
  }
  function toastRawError(context: string, error: unknown, code?: string) {
    toast(`${context} ${code ? `[${code}]` : ''} ${errorMessage(error)}`.replace(/\s+/g, ' ').trim(), { error: true });
  }
  function resetPhone() {
    otpHandledRef.current = false; setStep('phone'); setIsNewPinUser(false); setExistingUserId(null);
    setConfirmation(null); setOtp(''); setOtpError(null); setPinValue(''); setPinConfirm('');
    setUsernameInput(''); setUsernameError(null); setPendingPin(null); setLoading(false); setResendSeconds(0);
  }
  function resetAndClose() {
    resetPhone(); setPhoneInput(''); setPhoneError(null); setVerifiedPhone(''); setAcceptTerms(false);
    setToastState(null); setPickerVisible(false); closeDialog();
  }
  function openLink(url: string) {
    try { window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (error) { toastRawError('could not open link', error); }
  }
  async function getUserSafe(e164: string) { try { return await checkUser(e164); } catch { return null; } }
  async function performLogin(userId: string, username: string, token: string, phone: string) {
    const ok = await login(userId, username, token, { phone });
  if (!ok) { toast('Login failed. Please try again.', { error: true });
  return; }
    onSuccess?.(userId, username); resetAndClose();
  }
  function getOrCreateRecaptcha() {
    if (!firebaseAuth) throw new Error('Firebase is not configured.');
  if (recaptchaVerifier.current) return recaptchaVerifier.current;
  if (!recaptchaContainerRef.current) throw new Error('Phone verification is not ready. Please try again.');
    recaptchaVerifier.current = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current, { size: 'invisible' });
  return recaptchaVerifier.current;
  }

  async function handleSendOtp() {
    const validationError = validatePhone(phoneInput, country.dial);
    setPhoneError(validationError);
  if (validationError) return;
  if (!acceptTerms) { toast('Please accept Terms & Conditions', { warn: true });
  return; }
    if (!firebaseAuth) { toast('Firebase is not configured. Please try again later.', { error: true });
  return; }
    setLoading(true);
  const e164 = buildE164(phoneInput, country.dial);
    setVerifiedPhone(e164); otpHandledRef.current = false;
  try {
      try { await signOut(firebaseAuth); } catch { /* No previous Firebase session. */ }
      const result = await signInWithPhoneNumber(firebaseAuth, e164, getOrCreateRecaptcha());
      setConfirmation(result); setOtp(''); setOtpError(null); setResendSeconds(30);
  toast(`OTP sent to ${e164}`); setStep('otp');
    } catch (error) {
      const code = (error as { code?: string })?.code;
  console.warn('signInWithPhoneNumber failed:', code, errorMessage(error));
  if (typeof code === 'string' && code.startsWith('auth/')) {
        toastRawError('verifyPhoneNumber failed', error, code);
  await switchToPinFlow(e164);
      } else {
        toastRawError('verifyPhoneNumber unexpected', error);
  if (isNetworkError(error)) setLoading(false);
  else await switchToPinFlow(e164);
      }
    } finally { setLoading(false); }
  }
  async function switchToPinFlow(e164: string) {
    setVerifiedPhone(e164);
  const userData = await getUserSafe(e164);
  const exists = userData != null;
    setExistingUserId(exists ? (userData!.id?.toString() ?? null) : null);
    setIsNewPinUser(userData?.has_pin !== true);
    setPinValue(''); setPinConfirm(''); setStep('pin'); setLoading(false);
  }
  async function handleSubmitPin() {
    const validationError = validatePin(pin.trim());
  if (validationError) { toast('Enter a 4-digit PIN', { error: true });
  return; }
    const value = pin.trim();
  if (isNewPinUser) {
      if (pinConfirm.trim() !== value) { toast('PINs do not match', { error: true });
  return; }
      if (existingUserId) await attachPinToExistingUser(existingUserId, value);
  else showUsernameStep(value);
  return;
    }
    setLoading(true);
  try {
      const result = await pinLogin(verifiedPhone, value);
  if (result.ok && result.token && result.user) await performLogin(result.user.id, result.user.username ?? 'User', result.token, verifiedPhone);
  else toast(withStatus(result.message ?? 'Incorrect PIN', result.status), { error: true });
    } catch (error) { toastRawError('pin-login request failed', error); }
    finally { setLoading(false); }
  }
  async function attachPinToExistingUser(userId: string, value: string) {
    setLoading(true);
  try {
      const result = await setPin(userId, value);
  if (result.ok && result.token) await performLogin(userId, result.user?.username?.toString() ?? 'User', result.token, verifiedPhone);
  else toast(withStatus(result.message ?? 'Failed to set PIN', result.status), { error: true });
    } catch (error) { toastRawError('set-pin request failed', error); }
    finally { setLoading(false); }
  }
  async function handleVerifyOtp() {
    const code = otp.trim();
  const validationError = !code ? 'Required' : code.length !== 6 ? 'Enter 6 digits' : null;
    setOtpError(validationError);
  if (validationError) return;
  if (!confirmation) { toast('Verification expired. Go back and send a new code.', { error: true });
  return; }
    if (otpHandledRef.current) return;
    otpHandledRef.current = true; setLoading(true);
  try {
      const credential = await confirmation.confirm(code);
  if (!credential?.user) throw new Error('No user returned');
  await handleFirebaseUser(credential.user);
    } catch (error) {
      otpHandledRef.current = false; toastRawError('verifyOtp failed', error); setLoading(false);
    }
  }
  async function handleFirebaseUser(firebaseUser: FirebaseUser) {
    try {
      const token = await firebaseUser.getIdToken();
  const phone = firebaseUser.phoneNumber ?? verifiedPhone;
  const existing = await getUserSafe(phone);
  if (existing) {
        const userId = existing.id?.toString() ?? '';
  const username = existing.username?.toString() ?? 'User';
  if (token) await performLogin(userId, username, token, phone);
  else toast('Failed to get auth token', { error: true });
      } else showUsernameStep(null);
    } catch (error) { otpHandledRef.current = false; toastRawError('signIn failed', error); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (step !== 'otp' || !firebaseAuth) return;
  const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user || otpHandledRef.current) return;
  if (user.phoneNumber && user.phoneNumber !== verifiedPhone) return;
      otpHandledRef.current = true; setLoading(true);
  await handleFirebaseUser(user);
    });
  return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, verifiedPhone]);
  function showUsernameStep(pinForRegister: string | null) {
    setPendingPin(pinForRegister); setUsernameInput(''); setUsernameError(null); setStep('username');
  }
  async function handleCreateAccount() {
    const name = usernameInput.trim();
  const validationError = validateUsername(name);
  if (validationError) { setUsernameError(validationError);
  return; }
    setUsernameError(null); setLoading(true);
  try {
      if (await isUsernameTaken(name)) { toast('Username already taken', { error: true });
  return; }
      const result = await registerUser(name, verifiedPhone, pendingPin ?? undefined);
  if (result.ok && result.token && result.user) await performLogin(result.user.id, name, result.token, verifiedPhone);
  else toast(withStatus(result.message ?? 'Registration failed', result.status), { error: true });
    } catch (error) { toastRawError('register request failed', error); }
    finally { setLoading(false); }
  }

  const title = step === 'pin' ? (isNewPinUser ? 'Set PIN' : 'Enter PIN') : step === 'otp' ? 'Verify Phone' : step === 'username' ? 'Create Username' : 'Join Funspot,Relax,Enjoy';
  const renderButton = (label: string, action: () => void) => (
    <button
          type="button"
          onClick={action}
          disabled={loading}
          className="mt-1 flex w-full items-center justify-center rounded-full px-4 py-3.5 font-semibold disabled:opacity-60"
          style={{ background: colors.primary, color: colors.textInverse, ...fanText('body', colors, colors.textInverse) }}>
      {loading ? <span
          className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-label="Loading" /> : label}
    </button>
  );
  const renderGoBack = () =>
      <button
          type="button"
          onClick={resetPhone}
          className="self-center py-1 text-sm"
          style={{ color: colors.textTertiary }}>Wrong number? <span
          style={{ color: colors.primary, fontWeight: 600 }}>Go back</span>
      </button>;
  const renderCard = (icon: string, heading: string, body: string) => (
    <div
          className="flex flex-col items-center gap-1.5 rounded-2xl border p-4"
          style={{ borderColor: colors.border, background: colors.surfaceSunken }}>
      <span
          className="text-[40px] leading-none">{icon}</span>
      <h3
          className="text-center text-[17px] font-semibold"
          style={{ color: colors.textPrimary, ...fanText('headline', colors, colors.textPrimary) }}>{heading}</h3>
      <p
          className="text-center text-sm"
          style={{ color: colors.textTertiary, ...fanText('body', colors, colors.textTertiary) }}>{body}</p>
      </div>
  );
  const renderFieldError = (message: string | null) => message ? <p
          role="alert"
          className="text-sm"
          style={{ color: colors.away }}>{message}</p> : null;
  const toastColor = toastState?.kind === 'error' ? colors.away : toastState?.kind === 'warn' ? colors.draw : colors.primary;
  const inputClass = 'w-full min-w-0 rounded-xl border px-4 py-3.5 outline-none focus:ring-2';
  const inputStyle = { borderColor: colors.border, background: colors.surfaceSunken, color: colors.textPrimary, '--tw-ring-color': colors.primary } as React.CSSProperties;
  if (!visible) return null;
  return createPortal(
    <div
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget) resetAndClose(); }}>
      <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
          className="relative w-full max-w-lg overflow-hidden rounded-t-3xl px-5 pb-7 pt-3 shadow-2xl sm:rounded-3xl"
          style={{ maxHeight: 'min(90dvh, 850px)', background: colors.background }}
          onMouseDown={(event) => event.stopPropagation()}>
      <div
          className="mx-auto mb-3 h-1 w-10 rounded-full"
          style={{ background: colors.border }} />
      <div
          className="mb-3 flex items-center gap-2.5 py-1.5">
      <div
          className="flex h-8 w-8 items-center justify-center rounded-full border"
          style={{ background: colors.surfaceSunken, borderColor: colors.border }}>⚔️</div>
      <h2
          id="login-modal-title"
          className="text-lg font-semibold"
          style={{ color: colors.textPrimary, ...fanText('headline', colors, colors.textPrimary) }}>{title}</h2>
      <button
          type="button"
          onClick={resetAndClose}
          aria-label="Close sign in"
          className="ml-auto rounded-full px-3 py-2 text-sm"
          style={{ color: colors.textTertiary }}>✕</button>
      </div>
      <div
          className="overflow-y-auto pr-1"
          style={{ maxHeight: 'calc(min(90dvh, 850px) - 85px)' }}>
          {step === 'phone' && <div
          className="flex flex-col gap-3">
      <p
          className="text-sm"
          style={{ color: colors.textTertiary, ...fanText('body', colors, colors.textTertiary) }}>Enter your phone number to continue</p>
      <label
          htmlFor="login-phone"
          className="text-xs font-semibold tracking-wide"
          style={{ color: colors.textTertiary }}>PHONE NUMBER</label>
      <div
          className="flex items-stretch rounded-xl border"
          style={{ borderColor: colors.border, background: colors.surfaceSunken }}>
      <button
          type="button"
          onClick={() => setPickerVisible(true)}
          className="shrink-0 px-3 py-3.5 text-sm"
          aria-haspopup="dialog"
          style={{ color: colors.textPrimary }}>{isoToFlagEmoji(country.iso2)} {country.dial}</button>
      <div
          className="my-2 w-px"
          style={{ background: colors.border }} />
      <input
          id="login-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={phoneInput}
          onChange={(event) => { setPhoneInput(sanitizePhoneInput(event.target.value));
  if (phoneError) setPhoneError(null); }}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault();
  void handleSendOtp(); } }}
          placeholder="Phone number"
          className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm outline-none"
          style={{ color: colors.textPrimary }} />
      </div>
            {renderFieldError(phoneError)}
            {phoneInput.trim().length > 0 && <p
          className="-mt-1 text-xs"
          style={{ color: colors.primary }}>Will send to: {buildE164(phoneInput, country.dial)}</p>}
            <div
          className="flex items-start gap-2 pt-1">
      <button
          type="button"
          role="checkbox"
          aria-checked={acceptTerms}
          onClick={() => setAcceptTerms((value) => !value)}
          className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border"
          style={{ borderColor: acceptTerms ? colors.primary : colors.border, background: acceptTerms ? colors.primary : 'transparent', color: colors.textInverse }}>{acceptTerms ? '✓' : ''}</button>
      <p
          className="flex-1 text-xs leading-5"
          style={{ color: colors.textTertiary }}>I agree to the <a
          href={TERMS_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: colors.primary }}>Terms</a> and <a
          href={TERMS_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: colors.primary }}>Privacy Policy</a>
      </p>
      </div>
            {renderButton('Send OTP', () => { void handleSendOtp(); })}
          </div>}

          {step === 'otp' && <div
          className="flex flex-col gap-3">
            {renderCard('💬', 'Verify Your Phone', `OTP sent to ${verifiedPhone}`)}
            <label
          htmlFor="login-otp"
          className="text-xs font-semibold"
          style={{ color: colors.textTertiary }}>VERIFICATION CODE</label>
      <input
          id="login-otp"
          value={otp}
          onChange={(event) => { setOtp(sanitizeOtpInput(event.target.value));
  if (otpError) setOtpError(null); }}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault();
  void handleVerifyOtp(); } }}
          placeholder="Enter 6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6} autoFocus
          className={inputClass}
          style={inputStyle} />
            {renderFieldError(otpError)}
            {renderButton('Verify & Continue', () => { void handleVerifyOtp(); })}
            <button
          type="button"
          disabled={loading || resendSeconds > 0}
          onClick={() => { setConfirmation(null); setOtp('');
  void handleSendOtp(); }}
          className="self-center py-1 text-sm disabled:opacity-50"
          style={{ color: colors.primary }}>{resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}</button>
            {renderGoBack()}
          </div>}

          {step === 'pin' && <div
          className="flex flex-col gap-3">
            {renderCard(isNewPinUser ? '🔒' : '🔓', isNewPinUser ? 'Set Your PIN' : 'Enter Your PIN', isNewPinUser ? 'Create a 4-digit PIN to secure your account' : `Enter your 4-digit PIN for ${verifiedPhone}`)}
            <div
          className="flex items-center rounded-xl border pr-3"
          style={{ borderColor: colors.border, background: colors.surfaceSunken }}>
      <input
          type={pinObscure ? 'password' : 'text'}
          value={pin}
          onChange={(event) => setPinValue(sanitizePinInput(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter' && !isNewPinUser) { event.preventDefault();
  void handleSubmitPin(); } }}
          placeholder={isNewPinUser ? 'Create 4-digit PIN' : 'Enter your PIN'}
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={4}
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none"
          style={{ color: colors.textPrimary }} />
      <button
          type="button"
          onClick={() => setPinObscure((value) => !value)}
          className="px-1 py-2 text-xs"
          style={{ color: colors.textTertiary }}>{pinObscure ? 'Show' : 'Hide'}</button>
      </div>
            {isNewPinUser && <div
          className="flex items-center rounded-xl border pr-3"
          style={{ borderColor: colors.border, background: colors.surfaceSunken }}>
      <input
          type={pinConfirmObscure ? 'password' : 'text'}
          value={pinConfirm}
          onChange={(event) => setPinConfirm(sanitizePinInput(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault();
  void handleSubmitPin(); } }}
          placeholder="Confirm PIN"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none"
          style={{ color: colors.textPrimary }} />
      <button
          type="button"
          onClick={() => setPinConfirmObscure((value) => !value)}
          className="px-1 py-2 text-xs"
          style={{ color: colors.textTertiary }}>{pinConfirmObscure ? 'Show' : 'Hide'}</button>
      </div>}
            {renderButton(isNewPinUser ? 'Set PIN & Continue' : 'Login with PIN', () => { void handleSubmitPin(); })}
            {renderGoBack()}
          </div>}

          {step === 'username' && <div
          className="flex flex-col gap-3">
      <p
          className="text-sm"
          style={{ color: colors.textTertiary }}>Choose a username for your account (letters only)</p>
      <label
          htmlFor="login-username"
          className="text-xs font-semibold"
          style={{ color: colors.textTertiary }}>USERNAME</label>
      <input
          id="login-username"
          value={usernameInput}
          onChange={(event) => { const clean = sanitizeUsernameInput(event.target.value); setUsernameInput(clean);
  if (usernameError) setUsernameError(validateUsername(clean)); }}
          placeholder="e.g. JohnDoe"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          maxLength={20} autoFocus
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault();
  void handleCreateAccount(); } }}
          className={inputClass}
          style={inputStyle} />
            {renderFieldError(usernameError)}
            {renderButton('Create Account', () => { void handleCreateAccount(); })}
            <button
          type="button"
          onClick={resetPhone}
          disabled={loading}
          className="self-center py-1 text-sm disabled:opacity-50"
          style={{ color: colors.textTertiary }}>Cancel</button>
      </div>}
        </div>
      <div
          ref={recaptchaContainerRef}
          id="login-recaptcha-container"
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px overflow-hidden" aria-hidden="true" />
        {toastState && <div
          className="pointer-events-none absolute left-4 right-4 top-16 z-10"
          role="status" aria-live="polite">
      <div
          className="rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl"
          style={{ background: toastColor }}>{toastState.msg}</div>
      </div>}
      </section>

      {pickerVisible && createPortal(
        <div
          className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 sm:items-center sm:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget) { setPickerVisible(false); setCountrySearch(''); } }}>
      <section
          ref={countryDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Choose country"
          className="flex w-full max-w-lg flex-col gap-3 rounded-t-3xl px-6 pb-6 pt-3 sm:rounded-3xl"
          style={{ maxHeight: '80dvh', background: colors.background }}
          onMouseDown={(event) => event.stopPropagation()}>
      <div
          className="mx-auto mb-1 h-1 w-10 rounded-full"
          style={{ background: colors.border }} />
      <label
          htmlFor="country-search"
          className="text-sm font-semibold"
          style={{ color: colors.textPrimary }}>Choose country</label>
      <input
          id="country-search"
          value={countrySearch}
          onChange={(event) => setCountrySearch(event.target.value)}
          placeholder="Search country…" autoFocus
          className={inputClass}
          style={inputStyle} />
      <div
          className="overflow-y-auto"
          role="listbox"
          aria-label="Countries">
              {filteredCountries.map((item) =>
      <button
          type="button"
          role="option"
          aria-selected={item.iso2 === country.iso2}
          key={item.iso2}
          onClick={() => { setCountry(item); setPickerVisible(false); setCountrySearch(''); }}
          className="flex w-full items-center justify-between gap-3 border-b py-3 text-left text-sm"
          style={{ borderColor: colors.border, color: colors.textPrimary }}>
      <span>{isoToFlagEmoji(item.iso2)} {item.name}</span>
      <span
          style={{ color: colors.textTertiary }}>{item.dial}</span>
      </button>)}
              {filteredCountries.length === 0 && <p
          className="py-6 text-center text-sm"
          style={{ color: colors.textTertiary }}>No countries found.</p>}
            </div>
      </section>
      </div>, document.body,
      )}
    </div>,
    document.body,
  );
}
