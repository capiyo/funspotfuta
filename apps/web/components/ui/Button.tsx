// Web port of RN button.tsx. 'primary' = solid pill CTA, 'outline' = bordered "Load more" style.

import { ButtonHTMLAttributes } from 'react';

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  ...rest
}: {
  label: string;
  variant?: 'primary' | 'outline';
  loading?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const isDisabled = disabled || loading;
  const look =
    variant === 'primary'
      ? 'bg-fan-primary text-fan-textInverse'
      : 'border border-fan-border bg-fan-surfaceSunken text-fan-textSecondary';
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-fan-pill px-4 py-2 text-fan-button transition-opacity ${look} ${
        isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:opacity-85'
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        label
      )}
    </button>
  );
}
