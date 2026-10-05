// Web port of RN input.tsx. Variants: 'pill' (filters/search), 'plain' (composer), 'inline' (comment box).

import { InputHTMLAttributes } from 'react';

export function Input({
  variant = 'pill',
  className = '',
  ...rest
}: { variant?: 'pill' | 'plain' | 'inline' } & InputHTMLAttributes<HTMLInputElement>) {
  const look =
    variant === 'pill'
      ? 'rounded-fan-pill border border-fan-border bg-fan-surfaceSunken px-4 py-3'
      : variant === 'inline'
        ? 'border-b border-fan-border bg-transparent py-1'
        : 'min-h-[44px] bg-transparent';
  return (
    <input
      className={`w-full text-fan-body text-fan-textPrimary outline-none placeholder:text-fan-textTertiary focus:border-fan-borderFocus ${look} ${className}`}
      {...rest}
    />
  );
}
