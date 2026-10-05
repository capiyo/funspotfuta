// apps/mobile/modals/LoginModal.tsx
//
// 1:1 port of funspot/lib/modals/login_modal.dart
//
//   phone (+ accept terms) -> Firebase phone OTP
//      codeSent / auto-verified -> otp -> signIn:
//          existing user -> login with the Firebase ID token as session token
//          new user      -> username -> register (username + phone)
//      ANY Firebase failure (or non-network unexpected error) -> PIN fallback:
//          check-user -> has PIN          -> pin-login
//                     -> user, no PIN     -> set PIN (set-pin)
//                     -> no user          -> set PIN -> username -> register(+pin)
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth/auth-context';
import { checkUser, isUsernameTaken, pinLogin, setPin, registerUser } from '@funspot/core';
import {
  buildE164,
  validatePhone,
  validateUsername,
  validatePin,
} from '@/lib/auth/auth-validation';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

type Step = 'phone' | 'otp' | 'pin' | 'username';
type ToastKind = 'success' | 'warn' | 'error';

const TERMS_URL = 'https://clash-privacy.netlify.app/';

// ============================================================================
//  COUNTRY DATA
// ============================================================================
interface Country {
  name: string;
  iso2: string;
  dial: string;
}

function isoToFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

const COUNTRIES: Country[] = [
  { name: 'Kenya', iso2: 'KE', dial: '+254' },
  { name: 'United States', iso2: 'US', dial: '+1' },
  { name: 'United Kingdom', iso2: 'GB', dial: '+44' },
  { name: 'Nigeria', iso2: 'NG', dial: '+234' },
  { name: 'Ghana', iso2: 'GH', dial: '+233' },
  { name: 'South Africa', iso2: 'ZA', dial: '+27' },
  { name: 'Tanzania', iso2: 'TZ', dial: '+255' },
  { name: 'Uganda', iso2: 'UG', dial: '+256' },
  { name: 'Rwanda', iso2: 'RW', dial: '+250' },
  { name: 'Ethiopia', iso2: 'ET', dial: '+251' },
  { name: 'Egypt', iso2: 'EG', dial: '+20' },
  { name: 'India', iso2: 'IN', dial: '+91' },
  { name: 'Pakistan', iso2: 'PK', dial: '+92' },
  { name: 'Canada', iso2: 'CA', dial: '+1' },
  { name: 'Australia', iso2: 'AU', dial: '+61' },
  { name: 'Germany', iso2: 'DE', dial: '+49' },
  { name: 'France', iso2: 'FR', dial: '+33' },
  { name: 'Spain', iso2: 'ES', dial: '+34' },
  { name: 'Italy', iso2: 'IT', dial: '+39' },
  { name: 'Netherlands', iso2: 'NL', dial: '+31' },
  { name: 'UAE', iso2: 'AE', dial: '+971' },
  { name: 'Saudi Arabia', iso2: 'SA', dial: '+966' },
  { name: 'China', iso2: 'CN', dial: '+86' },
  { name: 'Brazil', iso2: 'BR', dial: '+55' },
  { name: 'Mexico', iso2: 'MX', dial: '+52' },
  { name: 'Zambia', iso2: 'ZM', dial: '+260' },
  { name: 'Zimbabwe', iso2: 'ZW', dial: '+263' },
  { name: 'Malawi', iso2: 'MW', dial: '+265' },
  { name: 'Somalia', iso2: 'SO', dial: '+252' },
  { name: 'DR Congo', iso2: 'CD', dial: '+243' },
];

const DEFAULT_COUNTRY: Country = COUNTRIES.find((c) => c.iso2 === 'KE')!;

// ============================================================================
//  HELPERS
// ============================================================================
const sanitizePhoneInput = (raw: string) => raw.replace(/[^\d\s\-().+]/g, '');
const sanitizePinInput = (raw: string) => raw.replace(/\D/g, '').slice(0, 4);
const sanitizeOtpInput = (raw: string) => raw.replace(/\D/g, '').slice(0, 6);
const sanitizeUsernameInput = (raw: string) => raw.replace(/[^a-zA-Z]/g, '');

// Port of Dart _isNetworkError.
function isNetworkError(e: unknown): boolean {
  const text = String((e as any)?.message ?? e).toLowerCase();
  return (
    text.includes('network-request-failed') ||
    text.includes('network request failed') ||
    text.includes('socketexception') ||
    text.includes('failed host lookup') ||
    text.includes('connection refused') ||
    text.includes('timeoutexception') ||
    text.includes('handshakeexception')
  );
}

function withStatus(message: string, status?: number): string {
  return status ? `${message} (status ${status})` : message;
}

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (userId: string, username: string) => void;
}

export default function LoginModal({ visible, onClose, onSuccess }: LoginModalProps) {
  const { login } = useAuth();
  const colors = useFanColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ── view state ─────────────────────────────
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [isNewPinUser, setIsNewPinUser] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // ── country / phone ────────────────────────
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [existingUserId, setExistingUserId] = useState<string | null>(null);

  // ── OTP ────────────────────────────────────
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // ── PIN ────────────────────────────────────
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinObscure, setPinObscure] = useState(true);
  const [pinConfirmObscure, setPinConfirmObscure] = useState(true);

  // ── username (Flutter shows this as a dialog) ──
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<string | null>(null);

  // ── toast (Flutter overlay toast: error 7s, warn 4s, success 3s) ──
  const [toastState, setToastState] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevents double-handling when Android auto-verification races with manual confirm.
  const otpHandledRef = useRef(false);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso2.toLowerCase() === q,
    );
  }, [countrySearch]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  function toast(msg: string, opts?: { error?: boolean; warn?: boolean }) {
    const kind: ToastKind = opts?.error ? 'error' : opts?.warn ? 'warn' : 'success';
    const seconds = kind === 'error' ? 7 : kind === 'warn' ? 4 : 3;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ msg, kind });
    toastTimer.current = setTimeout(() => setToastState(null), seconds * 1000);
  }

  function toastRawError(context: string, e: unknown, code?: string) {
    const label = code ? `[${code}]` : '';
    toast(`${context} ${label} ${String((e as any)?.message ?? e)}`.replace(/\s+/g, ' ').trim(), {
      error: true,
    });
  }

  // Port of Dart _resetPhone (keeps the typed phone and the terms checkbox).
  function resetPhone() {
    otpHandledRef.current = false;
    setStep('phone');
    setIsNewPinUser(false);
    setExistingUserId(null);
    setConfirmation(null);
    setOtp('');
    setOtpError(null);
    setPinValue('');
    setPinConfirm('');
    setUsernameInput('');
    setUsernameError(null);
    setPendingPin(null);
    setLoading(false);
  }

  function resetAndClose() {
    resetPhone();
    setPhoneInput('');
    setPhoneError(null);
    setVerifiedPhone('');
    setAcceptTerms(false);
    setToastState(null);
    onClose();
  }

  async function openLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch (e) {
      toastRawError('could not open link', e);
    }
  }

  // ─────────────────────────────────────────
  //  BACKEND HELPERS
  // ─────────────────────────────────────────
  // Port of _getUserByPhoneFull: any failure counts as "no user".
  async function getUserSafe(e164: string) {
    try {
      return await checkUser(e164);
    } catch {
      return null;
    }
  }

  // Port of _performLogin.
  async function performLogin(userId: string, username: string, token: string, phone: string) {
    // useAuth().login resolves to false (it doesn't throw) when saving the session fails.
    const ok = await login(userId, username, token, { phone });
    if (!ok) {
      toast('Login failed. Please try again.', { error: true });
      return;
    }
    // TODO: port _registerFcmTokenAfterLogin here (register the FCM token with the
    // backend now that userId + token are known), same as the Flutter app.
    onSuccess?.(userId, username);
    resetAndClose();
  }

  // ─────────────────────────────────────────
  //  STEP 1 — SEND OTP (with PIN fallback)
  // ─────────────────────────────────────────
  async function handleSendOtp() {
    const validationError = validatePhone(phoneInput, country.dial);
    setPhoneError(validationError);
    if (validationError) return;
    if (!acceptTerms) {
      toast('Please accept Terms & Conditions', { warn: true });
      return;
    }

    setLoading(true);
    const e164 = buildE164(phoneInput, country.dial);
    setVerifiedPhone(e164);
    otpHandledRef.current = false;

    try {
      // Drop any leftover Firebase session so it can't be mistaken for this login.
      try {
        await signOut(firebaseAuth);
      } catch { }

      const c = await signInWithPhoneNumber(
        firebaseAuth,
        e164,
        // Older RNFirebase typings require this arg (web-only reCAPTCHA verifier);
        // native ignores it. Remove the cast after upgrading @react-native-firebase/*.
        undefined as any,
      );
      setConfirmation(c);
      setOtp('');
      setOtpError(null);
      toast(`OTP sent to ${e164}`);
      setStep('otp');
      setLoading(false);
    } catch (e: any) {
      const code: string | undefined = e?.code;
      console.warn('signInWithPhoneNumber failed:', code, e?.message);
      if (typeof code === 'string' && code.startsWith('auth/')) {
        // FirebaseAuthException: every code falls back to the PIN flow.
        toastRawError('verifyPhoneNumber failed', e, code);
        await switchToPinFlow(e164);
      } else {
        toastRawError('verifyPhoneNumber unexpected', e);
        if (isNetworkError(e)) {
          setLoading(false);
        } else {
          await switchToPinFlow(e164);
        }
      }
    }
  }

  // ─────────────────────────────────────────
  //  PIN FALLBACK FLOW
  // ─────────────────────────────────────────
  async function switchToPinFlow(e164: string) {
    setVerifiedPhone(e164);
    const userData = await getUserSafe(e164);
    const exists = userData != null;
    const hasPin = userData?.has_pin === true;

    setExistingUserId(exists ? (userData!.id?.toString() ?? null) : null);
    setIsNewPinUser(!hasPin);
    setPinValue('');
    setPinConfirm('');
    setStep('pin');
    setLoading(false);
  }

  async function handleSubmitPin() {
    const pinError = validatePin(pin.trim());
    if (pinError) {
      toast('Enter a 4-digit PIN', { error: true });
      return;
    }
    const value = pin.trim();

    if (isNewPinUser) {
      if (pinConfirm.trim() !== value) {
        toast('PINs do not match', { error: true });
        return;
      }
      if (existingUserId) {
        await attachPinToExistingUser(existingUserId, value);
      } else {
        showUsernameStep(value);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await pinLogin(verifiedPhone, value);
      if (res.ok && res.token && res.user) {
        await performLogin(res.user.id, res.user.username ?? 'User', res.token, verifiedPhone);
      } else {
        toast(withStatus(res.message ?? 'Incorrect PIN', res.status), { error: true });
      }
    } catch (e) {
      toastRawError('pin-login request failed', e);
    } finally {
      setLoading(false);
    }
  }

  async function attachPinToExistingUser(userId: string, value: string) {
    setLoading(true);
    try {
      const res = await setPin(userId, value);
      if (res.ok && res.token) {
        const username = res.user?.username?.toString() ?? 'User';
        await performLogin(userId, username, res.token, verifiedPhone);
      } else {
        toast(withStatus(res.message ?? 'Failed to set PIN', res.status), { error: true });
      }
    } catch (e) {
      toastRawError('set-pin request failed', e);
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────
  //  STEP 2 — VERIFY OTP (Firebase path)
  // ─────────────────────────────────────────
  async function handleVerifyOtp() {
    const code = otp.trim();
    const err = !code ? 'Required' : code.length !== 6 ? 'Enter 6 digits' : null;
    setOtpError(err);
    if (err) return;
    if (!confirmation) {
      toast('Verification expired. Go back and send a new code.', { error: true });
      return;
    }
    if (otpHandledRef.current) return;
    otpHandledRef.current = true;

    setLoading(true);
    try {
      const cred = await confirmation.confirm(code);
      if (!cred?.user) throw new Error('No user returned');
      await handleFirebaseUser(cred.user);
    } catch (e) {
      otpHandledRef.current = false;
      toastRawError('verifyOtp failed', e);
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────
  //  STEP 3 — SIGN IN (Firebase path) — port of _signIn
  //  The Firebase ID token is used as the session token, exactly like Flutter.
  // ─────────────────────────────────────────
  async function handleFirebaseUser(fUser: FirebaseAuthTypes.User) {
    try {
      const token = await fUser.getIdToken();
      const phone = fUser.phoneNumber ?? verifiedPhone;

      const existing = await getUserSafe(phone);
      if (existing) {
        const uid = existing.id?.toString() ?? '';
        const username = existing.username?.toString() ?? 'User';
        if (token) {
          await performLogin(uid, username, token, phone);
        } else {
          toast('Failed to get auth token', { error: true });
        }
      } else {
        showUsernameStep(null);
      }
    } catch (e) {
      otpHandledRef.current = false;
      toastRawError('signIn failed', e);
    } finally {
      setLoading(false);
    }
  }

  // Android auto-verification (Flutter's verificationCompleted): Firebase may
  // sign the user in without the code being typed.
  useEffect(() => {
    if (step !== 'otp') return;
    const unsub = onAuthStateChanged(firebaseAuth, async (user: FirebaseAuthTypes.User | null) => {
      if (!user || otpHandledRef.current) return;
      if (user.phoneNumber && user.phoneNumber !== verifiedPhone) return;
      otpHandledRef.current = true;
      setLoading(true);
      await handleFirebaseUser(user);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, verifiedPhone]);

  // ─────────────────────────────────────────
  //  NEW USER — USERNAME (Flutter dialog)
  // ─────────────────────────────────────────
  function showUsernameStep(pinForRegister: string | null) {
    setPendingPin(pinForRegister);
    setUsernameInput('');
    setUsernameError(null);
    setStep('username');
  }

  async function handleCreateAccount() {
    const name = usernameInput.trim();
    const validationError = validateUsername(name);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }
    setUsernameError(null);
    setLoading(true);
    try {
      if (await isUsernameTaken(name)) {
        toast('Username already taken', { error: true });
        return;
      }
      const res = await registerUser(name, verifiedPhone, pendingPin ?? undefined);
      if (res.ok && res.token && res.user) {
        await performLogin(res.user.id, name, res.token, verifiedPhone);
      } else {
        toast(withStatus(res.message ?? 'Registration failed', res.status), { error: true });
      }
    } catch (e) {
      toastRawError('register request failed', e);
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────
  //  RENDER HELPERS
  // ─────────────────────────────────────────
  const title =
    step === 'pin'
      ? isNewPinUser
        ? 'Set PIN'
        : 'Enter PIN'
      : step === 'otp'
        ? 'Verify Phone'
        : step === 'username'
          ? 'Create Username'
          : 'Join Funspot,Relax,Enjoy';

  const renderButton = (label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[styles.button, loading && styles.buttonDisabled]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textInverse} />
      ) : (
        <Text style={[fanText('body', colors, colors.textInverse), styles.buttonText]}>{label}</Text>
      )}
    </Pressable>
  );

  const renderGoBack = () => (
    <Pressable onPress={resetPhone} style={styles.link}>
      <Text style={fanText('caption', colors, colors.textTertiary)}>
        Wrong number? <Text style={{ color: colors.primary, fontWeight: '600' }}>Go back</Text>
      </Text>
    </Pressable>
  );

  const renderCard = (icon: string, heading: string, body: string) => (
    <View style={styles.card}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <Text style={[fanText('headline', colors, colors.textPrimary), styles.cardTitle]}>
        {heading}
      </Text>
      <Text style={[fanText('body', colors, colors.textTertiary), styles.centerText]}>{body}</Text>
    </View>
  );

  const renderFieldError = (msg: string | null) =>
    msg ? <Text style={fanText('caption', colors, colors.away)}>{msg}</Text> : null;

  const toastColor =
    toastState?.kind === 'error'
      ? colors.away
      : toastState?.kind === 'warn'
        ? colors.draw
        : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <Pressable style={styles.backdrop} onPress={resetAndClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />

            <View style={styles.headerRow}>
              <View style={styles.headerIcon}>
                <Text style={{ fontSize: 16 }}>⚔️</Text>
              </View>
              <Text style={fanText('headline', colors, colors.textPrimary)}>{title}</Text>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {step === 'phone' && (
                <View style={styles.stepGap}>
                  <Text style={fanText('body', colors, colors.textTertiary)}>
                    Enter your phone number to continue
                  </Text>
                  <Text style={fanText('caption', colors, colors.textTertiary)}>PHONE NUMBER</Text>
                  <View style={styles.phoneRow}>
                    <Pressable style={styles.dialCodeButton} onPress={() => setPickerVisible(true)}>
                      <Text style={fanText('body', colors, colors.textPrimary)}>
                        {isoToFlagEmoji(country.iso2)} {country.dial}
                      </Text>
                    </Pressable>
                    <View style={styles.divider} />
                    <TextInput
                      value={phoneInput}
                      onChangeText={(t) => {
                        setPhoneInput(sanitizePhoneInput(t));
                        if (phoneError) setPhoneError(null);
                      }}
                      placeholder="Phone number"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="phone-pad"
                      style={styles.phoneInput}
                      onSubmitEditing={handleSendOtp}
                    />
                  </View>
                  {renderFieldError(phoneError)}
                  {phoneInput.trim().length > 0 && (
                    <Text style={[fanText('caption', colors, colors.primary), styles.hint]}>
                      Will send to: {buildE164(phoneInput, country.dial)}
                    </Text>
                  )}

                  <View style={styles.termsRow}>
                    <Pressable
                      onPress={() => setAcceptTerms((v) => !v)}
                      style={[styles.checkbox, acceptTerms && styles.checkboxOn]}
                      hitSlop={8}
                    >
                      {acceptTerms && (
                        <Text style={{ color: colors.textInverse, fontSize: 12 }}>✓</Text>
                      )}
                    </Pressable>
                    <Text style={[fanText('caption', colors, colors.textTertiary), { flex: 1 }]}>
                      I agree to the{' '}
                      <Text style={{ color: colors.primary }} onPress={() => openLink(TERMS_URL)}>
                        Terms
                      </Text>{' '}
                      and{' '}
                      <Text style={{ color: colors.primary }} onPress={() => openLink(TERMS_URL)}>
                        Privacy Policy
                      </Text>
                    </Text>
                  </View>

                  {renderButton('Send OTP', handleSendOtp)}
                </View>
              )}

              {step === 'otp' && (
                <View style={styles.stepGap}>
                  {renderCard('💬', 'Verify Your Phone', `OTP sent to ${verifiedPhone}`)}
                  <TextInput
                    value={otp}
                    onChangeText={(t) => {
                      setOtp(sanitizeOtpInput(t));
                      if (otpError) setOtpError(null);
                    }}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    onSubmitEditing={handleVerifyOtp}
                    style={styles.input}
                  />
                  {renderFieldError(otpError)}
                  {renderButton('Verify & Continue', handleVerifyOtp)}
                  {renderGoBack()}
                </View>
              )}

              {step === 'pin' && (
                <View style={styles.stepGap}>
                  {renderCard(
                    isNewPinUser ? '🔒' : '🔓',
                    isNewPinUser ? 'Set Your PIN' : 'Enter Your PIN',
                    isNewPinUser
                      ? 'Create a 4-digit PIN to secure your account'
                      : `Enter your 4-digit PIN for ${verifiedPhone}`,
                  )}
                  <View style={styles.pinRow}>
                    <TextInput
                      value={pin}
                      onChangeText={(t) => setPinValue(sanitizePinInput(t))}
                      placeholder={isNewPinUser ? 'Create 4-digit PIN' : 'Enter your PIN'}
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry={pinObscure}
                      onSubmitEditing={isNewPinUser ? undefined : handleSubmitPin}
                      style={styles.pinField}
                    />
                    <Pressable onPress={() => setPinObscure((v) => !v)} hitSlop={8}>
                      <Text style={fanText('caption', colors, colors.textTertiary)}>
                        {pinObscure ? 'Show' : 'Hide'}
                      </Text>
                    </Pressable>
                  </View>
                  {isNewPinUser && (
                    <View style={styles.pinRow}>
                      <TextInput
                        value={pinConfirm}
                        onChangeText={(t) => setPinConfirm(sanitizePinInput(t))}
                        placeholder="Confirm PIN"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry={pinConfirmObscure}
                        onSubmitEditing={handleSubmitPin}
                        style={styles.pinField}
                      />
                      <Pressable onPress={() => setPinConfirmObscure((v) => !v)} hitSlop={8}>
                        <Text style={fanText('caption', colors, colors.textTertiary)}>
                          {pinConfirmObscure ? 'Show' : 'Hide'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                  {renderButton(
                    isNewPinUser ? 'Set PIN & Continue' : 'Login with PIN',
                    handleSubmitPin,
                  )}
                  {renderGoBack()}
                </View>
              )}

              {step === 'username' && (
                <View style={styles.stepGap}>
                  <Text style={fanText('body', colors, colors.textTertiary)}>
                    Choose a username for your account (letters only)
                  </Text>
                  <TextInput
                    value={usernameInput}
                    onChangeText={(t) => {
                      const clean = sanitizeUsernameInput(t);
                      setUsernameInput(clean);
                      if (usernameError) setUsernameError(validateUsername(clean));
                    }}
                    placeholder="e.g. JohnDoe"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    maxLength={20}
                    onSubmitEditing={handleCreateAccount}
                    style={styles.input}
                  />
                  {renderFieldError(usernameError)}
                  {renderButton('Create Account', handleCreateAccount)}
                  <Pressable onPress={resetPhone} style={styles.link} disabled={loading}>
                    <Text style={fanText('caption', colors, colors.textTertiary)}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>

        {toastState && (
          <View pointerEvents="none" style={styles.toastWrap}>
            <View style={[styles.toast, { backgroundColor: toastColor }]}>
              <Text selectable style={styles.toastText}>
                {toastState.msg}
              </Text>
            </View>
          </View>
        )}
      </Pressable>

      {/* ── Country picker modal ─────────────────────────────── */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country…"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoFocus
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.iso2}
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerRow}
                  onPress={() => {
                    setCountry(item);
                    setPickerVisible(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={fanText('body', colors, colors.textPrimary)}>
                    {isoToFlagEmoji(item.iso2)}  {item.name}
                  </Text>
                  <Text style={fanText('body', colors, colors.textTertiary)}>{item.dial}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useFanColors>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetWrap: { width: '100%' },
    sheet: {
      width: '100%',
      maxHeight: '85%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    scrollContent: { paddingTop: 8, paddingBottom: 32 },
    pickerSheet: {
      width: '100%',
      maxHeight: '80%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 24,
      gap: 12,
    },
    pickerList: { marginTop: 8 },
    pickerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepGap: { gap: 12 },
    centerText: { textAlign: 'center' },
    hint: { marginTop: -4 },
    link: { alignSelf: 'center', paddingVertical: 4 },
    card: {
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
      gap: 6,
    },
    cardIcon: { fontSize: 40 },
    cardTitle: { textAlign: 'center', fontSize: 17 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
      borderRadius: 12,
    },
    dialCodeButton: { paddingHorizontal: 12, paddingVertical: 14 },
    divider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    phoneInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 14,
      color: colors.textPrimary,
    },
    pinRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
      borderRadius: 12,
      paddingRight: 14,
    },
    pinField: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
    },
    termsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontWeight: '600' },
    toastWrap: { position: 'absolute', top: 60, left: 16, right: 16 },
    toast: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toastText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  });
}