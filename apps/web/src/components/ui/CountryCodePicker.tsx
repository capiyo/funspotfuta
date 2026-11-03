import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FanColorPalette } from '@funspot/core';
import { FAN_RADIUS, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { ICON } from '@/theme/layout';

export interface CountryOption {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}
export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'KE', dialCode: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', dialCode: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'NG', dialCode: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'GH', dialCode: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: 'ZA', dialCode: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: 'TZ', dialCode: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { code: 'UG', dialCode: '+256', flag: '🇺🇬', name: 'Uganda' },
];
export const DEFAULT_COUNTRY = COUNTRY_OPTIONS[0];

export function CountryCodePicker({ colors, value, onChange }: {
  colors: FanColorPalette;
  value: CountryOption;
  onChange: (country: CountryOption) => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="country-code-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: FAN_SPACING.xs, paddingInline: FAN_SPACING.base, border: 0, borderRight: `1px solid ${colors.border}`, background: 'transparent' }} aria-haspopup="dialog" aria-expanded={open}>
      <span>{value.flag}</span><span style={fanText('body', colors, colors.textPrimary)}>{value.dialCode}</span><ChevronDown size={ICON.sm} color={colors.textTertiary} />
    </button>
    {open && <div className="country-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }} role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: FAN_SPACING.xxl }}>
      <section className="country-picker-sheet" role="dialog" aria-modal="true" aria-label="Select country" style={{ width: 'min(100%, 420px)', maxHeight: '60vh', overflowY: 'auto', background: colors.background, borderRadius: FAN_RADIUS.md, border: `1px solid ${colors.border}`, paddingBlock: FAN_SPACING.sm }}>
        <h2 style={{ ...fanText('caption', colors, colors.textSecondary), padding: `${FAN_SPACING.sm}px ${FAN_SPACING.lg}px`, margin: 0 }}>SELECT COUNTRY</h2>
        {COUNTRY_OPTIONS.map((country) => <button key={country.code} type="button" onClick={() => { onChange(country); setOpen(false); }} className="country-picker-row" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: FAN_SPACING.base, padding: `${FAN_SPACING.base}px ${FAN_SPACING.lg}px`, border: 0, borderTop: `1px solid ${colors.border}`, background: 'transparent', textAlign: 'left' }}>
          <span>{country.flag}</span><span style={{ ...fanText('body', colors, colors.textPrimary), flex: 1 }}>{country.name}</span><span style={fanText('caption', colors, colors.textTertiary)}>{country.dialCode}</span>
        </button>)}
      </section>
    </div>}
  </>;
}
