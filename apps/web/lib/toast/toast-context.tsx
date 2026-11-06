// Ported from funspot/lib/services/toast_helper.dart — same 4 variants,
// same colors (green/red/blue/orange), same default durations
// (short = 2s, long = 3.5s, matching Fluttertoast's LENGTH_SHORT/LONG).

import { createContext, useCallback, useContext, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
  warning: 'bg-orange-500',
};
const VARIANT_DURATION_MS: Record<ToastVariant, number> = {
  success: 2000,
  error: 3500,
  info: 2000,
  warning: 2000,
};

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, variant: ToastVariant) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, VARIANT_DURATION_MS[variant]);
  }, []);

  const value: ToastContextValue = {
    showSuccess: (m) => show(m, 'success'),
    showError: (m) => show(m, 'error'),
    showInfo: (m) => show(m, 'info'),
    showWarning: (m) => show(m, 'warning'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${VARIANT_STYLES[t.variant]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
