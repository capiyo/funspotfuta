// lib/auth/auth-validation.ts
//
// Ported 1:1 from the two `validateUsername` copies in
// funspot/lib/modals/login_modal.dart (they were identical — the Dart file
// just had it duplicated), plus `_buildE164`. Neither of these made it into
// the RN port; `handleRegister` was only checking `length >= 3`, and
// `toE164` in LoginModal.tsx didn't handle the '0' prefix / already-dialed
// / '00' cases the Dart version does.

const BLOCKED_PATTERNS: RegExp[] = [
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

const SEQUENTIAL = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i;
const KEYBOARD = /(?:qwerty|asdfgh|zxcvbn|qwert|asdf|zxcv|qwe|asd|zxc|poiu|poi|lkj|mnb)/i;

/** Returns an error message, or null if the username is valid. */
export function validateUsername(username: string): string | null {
    if (!username) return 'Username is required';
    const trimmed = username.trim();

    if (trimmed.length < 3) return 'Username must be at least 3 characters';
    if (trimmed.length > 20) return 'Username must be less than 20 characters';
    if (!/^[a-zA-Z]+$/.test(trimmed)) return 'Username must contain only letters (a-z)';

    const lower = trimmed.toLowerCase();
    if (BLOCKED_PATTERNS.some((p) => p.test(lower))) return 'This username is not allowed';
    if (/^[0-9+\-\s()]{8,}$/.test(trimmed)) return 'Username cannot be a phone number';
    if (/^(.)\1{2,}$/.test(trimmed)) return 'Username cannot have repeated characters only';
    if (SEQUENTIAL.test(lower)) return 'Username cannot contain sequential patterns (abc, xyz)';
    if (KEYBOARD.test(lower)) return 'Username cannot contain keyboard patterns';

    return null;
}

/**
 * Ported from `_buildE164` in login_modal.dart. Handles:
 *  - already-international input ("+2547...")
 *  - "00"-prefixed international dialing
 *  - a local number that already includes the dial code digits without '+'
 *  - a local number with a leading trunk '0' (e.g. Kenyan "07...")
 */
export function buildE164(raw: string, dialCode: string): string {
    let s = raw.trim().replace(/[\s\-().]/g, '');
    if (s.startsWith('+')) return s;
    if (s.startsWith('00')) return `+${s.slice(2)}`;

    const dialDigits = dialCode.replace('+', '');
    if (s.startsWith(dialDigits) && s.length > dialDigits.length + 4) {
        return `+${s}`;
    }
    if (s.startsWith('0')) s = s.slice(1);
    return `${dialCode}${s}`;
}

/** Mirrors the Dart phone TextFormField validator (7–12 raw digits, final E.164 10–15 digits). */
export function validatePhone(raw: string, dialCode: string): string | null {
    if (!raw || !raw.trim()) return 'Required';
    const cleaned = raw.trim().replace(/[\s\-()]/g, '');
    if (!/^[0-9]{7,12}$/.test(cleaned)) return 'Enter a valid phone number';
    const e164 = buildE164(raw, dialCode);
    if (!/^\+\d{10,15}$/.test(e164)) return 'Enter a valid phone number';
    return null;
}

export function validatePin(pin: string): string | null {
    if (!/^\d{4}$/.test(pin)) return 'Enter a 4-digit PIN';
    return null;
}