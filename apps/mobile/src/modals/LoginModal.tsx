// apps/mobile/modals/LoginModal.tsx
import { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/lib/auth/auth-context';
import { checkUser, isUsernameTaken, pinLogin, setPin, registerUser } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

type Step = 'phone' | 'pin' | 'newPin' | 'username';

// ============================================================================
//  COUNTRY DATA — mirrors Flutter's CountryCodePicker favorites list
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

const FAVORITE_ISO2 = ['KE', 'US', 'GB', 'NG', 'GH', 'ZA', 'TZ', 'UG'];

// A working set of common countries. Extend as needed — this isn't
// exhaustive, but covers the favorites plus common international users.
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
//  PHONE NORMALIZATION — direct port of Flutter's _buildE164
// ============================================================================
function buildE164(raw: string, dialCode: string): string {
  let s = raw.trim().replace(/[\s\-().]/g, '');

  if (s.startsWith('+')) return s;
  if (s.startsWith('00')) return `+${s.slice(2)}`;

  const dialDigits = dialCode.replace('+', '');

  // Country code typed without '+' (e.g. "254712345678")
  if (s.startsWith(dialDigits) && s.length > dialDigits.length + 4) {
    // Guard against a leftover trunk '0' after the country code
    // (e.g. "2540712345678" -> "254712345678")
    const rest = s.slice(dialDigits.length);
    const normalizedRest = rest.startsWith('0') ? rest.slice(1) : rest;
    return `${dialCode}${normalizedRest}`;
  }

  // Local format with leading trunk '0' (e.g. "0712345678")
  if (s.startsWith('0')) s = s.slice(1);
  return `${dialCode}${s}`;
}

// Character-level cleanup as the user types: only digits, spaces, dashes,
// parens, dots and a leading '+' are legal in a phone field.
function sanitizePhoneInput(raw: string): string {
  return raw.replace(/[^\d\s\-().+]/g, '');
}

function validatePhone(raw: string, dialCode: string): string | null {
  if (!raw.trim()) return 'Required';
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (!/^\+?\d{7,12}$/.test(cleaned)) return 'Enter a valid phone number';
  const e164 = buildE164(raw, dialCode);
  if (!/^\+\d{10,15}$/.test(e164)) return 'Enter a valid phone number';
  return null;
}

// ============================================================================
//  PIN VALIDATION
// ============================================================================
function sanitizePinInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

// ============================================================================
//  USERNAME VALIDATION — direct port of Flutter's validateUsername
// ============================================================================
const BLOCKED_USERNAME_PATTERNS: RegExp[] = [
  /^admin$/i,
  /^administrator$/i,
  /^superadmin$/i,
  /^root$/i,
  /^sysadmin$/i,
  /^moderator$/i,
  /^mod$/i,
  /^staff$/i,
  /^support$/i,
  /^helpdesk$/i,
  /^webmaster$/i,
  /^master$/i,
  /^system$/i,
  /^test$/i,
  /^user$/i,
  /^guest$/i,
  /^anonymous$/i,
  /^default$/i,
  /^example$/i,
  /^null$/i,
  /^undefined$/i,
  /^service$/i,
  /^api$/i,
  /^bot$/i,
  /^cron$/i,
  /^daemon$/i,
  /^clash$/i,
  /^fanclash$/i,
  /^clashfan$/i,
  /^clashadmin$/i,
  /^clashmod$/i,
  /^clashstaff$/i,
  /admin/i,
  /root/i,
  /super/i,
  /mod/i,
];

const SEQUENTIAL_RE =
  /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/;

const KEYBOARD_PATTERN_RE =
  /(?:qwerty|asdfgh|zxcvbn|qwert|asdf|zxcv|qwe|asd|zxc|poiu|poi|lkj|mnb)/;

function validateUsername(username: string): string | null {
  if (!username) return 'Username is required';
  const trimmed = username.trim();
  if (trimmed.length < 3) return 'Username must be at least 3 characters';
  if (trimmed.length > 20) return 'Username must be less than 20 characters';

  if (!/^[a-zA-Z]+$/.test(trimmed)) {
    return 'Username must contain only letters (a-z)';
  }

  const lower = trimmed.toLowerCase();
  for (const pattern of BLOCKED_USERNAME_PATTERNS) {
    if (pattern.test(lower)) return 'This username is not allowed';
  }

  if (/^(.)\1{2,}$/.test(trimmed)) {
    return 'Username cannot have repeated characters only';
  }
  if (SEQUENTIAL_RE.test(lower)) {
    return 'Username cannot contain sequential patterns (abc, xyz)';
  }
  if (KEYBOARD_PATTERN_RE.test(lower)) {
    return 'Username cannot contain keyboard patterns';
  }

  return null;
}

// Strip anything that isn't a letter as the user types — mirrors the
// letters-only rule up front instead of only catching it on submit.
function sanitizeUsernameInput(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, '');
}

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (userId: string, username: string) => void;
}

export default function LoginModal({ visible, onClose, onSuccess }: LoginModalProps) {
  const { login } = useAuth();
  const colors = useFanColors();

  const [step, setStep] = useState<Step>('phone');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const [phoneInput, setPhoneInput] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso2.toLowerCase() === q,
    );
  }, [countrySearch]);

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
    onSuccess?.(userId, username);
    resetAndClose();
  }

  async function handlePhoneSubmit() {
    setError(null);
    const validationError = validatePhone(phoneInput, country.dial);
    if (validationError) {
      setError(validationError);
      return;
    }
    const e164 = buildE164(phoneInput, country.dial);
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
    const validationError = validateUsername(usernameInput);
    if (validationError) {
      setError(validationError);
      return;
    }
    const name = usernameInput.trim();
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

  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <Pressable style={styles.backdrop} onPress={resetAndClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />

            <Text style={[fanText('headline', colors, colors.textPrimary), styles.title]}>
              Funspot
            </Text>
            <Text style={[fanText('body', colors, colors.textTertiary), styles.subtitle]}>
              Where Champions Are Crowned
            </Text>

            {step === 'phone' && (
              <View style={styles.stepGap}>
                <Text style={fanText('caption', colors, colors.textTertiary)}>Phone number</Text>
                <View style={styles.phoneRow}>
                  <Pressable
                    style={styles.dialCodeButton}
                    onPress={() => setPickerVisible(true)}
                  >
                    <Text style={fanText('body', colors, colors.textPrimary)}>
                      {isoToFlagEmoji(country.iso2)} {country.dial}
                    </Text>
                  </Pressable>
                  <View style={styles.divider} />
                  <TextInput
                    value={phoneInput}
                    onChangeText={(t) => setPhoneInput(sanitizePhoneInput(t))}
                    placeholder="Phone number"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="phone-pad"
                    style={styles.phoneInput}
                    onSubmitEditing={handlePhoneSubmit}
                  />
                </View>
                {phoneInput.trim().length > 0 && (
                  <Text style={[fanText('caption', colors, colors.primary), styles.hint]}>
                    Will send to: {buildE164(phoneInput, country.dial)}
                  </Text>
                )}
                <Pressable
                  onPress={handlePhoneSubmit}
                  disabled={loading}
                  style={[styles.button, loading && styles.buttonDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={[fanText('body', colors, colors.textInverse), styles.buttonText]}>
                      Continue
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            {step === 'pin' && (
              <View style={styles.stepGap}>
                <Text style={[fanText('body', colors, colors.textTertiary), styles.centerText]}>
                  Enter your 4-digit PIN for {verifiedPhone}
                </Text>
                <TextInput
                  value={pin}
                  onChangeText={(t) => setPinValue(sanitizePinInput(t))}
                  placeholder="••••"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  style={[styles.input, styles.pinInput]}
                />
                <Pressable
                  onPress={handlePinLogin}
                  disabled={loading}
                  style={[styles.button, loading && styles.buttonDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={[fanText('body', colors, colors.textInverse), styles.buttonText]}>
                      Log In
                    </Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setStep('phone')}>
                  <Text style={fanText('caption', colors, colors.textTertiary)}>
                    Use a different number
                  </Text>
                </Pressable>
              </View>
            )}

            {step === 'newPin' && (
              <View style={styles.stepGap}>
                <Text style={[fanText('body', colors, colors.textTertiary), styles.centerText]}>
                  {existingUserId
                    ? 'Set a 4-digit PIN for your account'
                    : `Create a PIN for ${verifiedPhone}`}
                </Text>
                <TextInput
                  value={pin}
                  onChangeText={(t) => setPinValue(sanitizePinInput(t))}
                  placeholder="New PIN"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  style={[styles.input, styles.pinInput]}
                />
                <TextInput
                  value={pinConfirm}
                  onChangeText={(t) => setPinConfirm(sanitizePinInput(t))}
                  placeholder="Confirm PIN"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  style={[styles.input, styles.pinInput]}
                />
                <Pressable
                  onPress={handleSetNewPin}
                  disabled={loading}
                  style={[styles.button, loading && styles.buttonDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={[fanText('body', colors, colors.textInverse), styles.buttonText]}>
                      Continue
                    </Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setStep('phone')}>
                  <Text style={fanText('caption', colors, colors.textTertiary)}>
                    Use a different number
                  </Text>
                </Pressable>
              </View>
            )}

            {step === 'username' && (
              <View style={styles.stepGap}>
                <Text style={[fanText('body', colors, colors.textTertiary), styles.centerText]}>
                  Pick a username (letters only)
                </Text>
                <TextInput
                  value={usernameInput}
                  onChangeText={(t) => {
                    setUsernameInput(sanitizeUsernameInput(t));
                    if (error) setError(validateUsername(sanitizeUsernameInput(t)));
                  }}
                  placeholder="username"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  maxLength={20}
                  style={styles.input}
                />
                <Pressable
                  onPress={handleRegister}
                  disabled={loading}
                  style={[styles.button, loading && styles.buttonDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={[fanText('body', colors, colors.textInverse), styles.buttonText]}>
                      Create Account
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            {error && (
              <Text style={[fanText('body', colors, colors.away), styles.errorText]}>{error}</Text>
            )}
            {info && (
              <Text style={[fanText('body', colors, colors.primary), styles.infoText]}>{info}</Text>
            )}
          </Pressable>
        </KeyboardAvoidingView>
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
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 32,
    },
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
      marginBottom: 16,
    },
    title: { textAlign: 'center', marginBottom: 4 },
    subtitle: { textAlign: 'center', marginBottom: 28 },
    stepGap: { gap: 12 },
    centerText: { textAlign: 'center' },
    hint: { marginTop: -4 },
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
    dialCodeButton: {
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
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
    pinInput: {
      textAlign: 'center',
      fontSize: 24,
      letterSpacing: 16,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontWeight: '600' },
    errorText: { marginTop: 16, textAlign: 'center' },
    infoText: { marginTop: 16, textAlign: 'center' },
  });
}