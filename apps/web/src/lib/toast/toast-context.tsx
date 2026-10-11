import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const VARIANT_COLOR: Record<ToastVariant, string> = {
  success: '#059669',
  error: '#DC2626',
  info: '#2563EB',
  warning: '#F97316',
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
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant) => {
    const id = nextId++;
    setToasts((previous) => [...previous, { id, message, variant }]);
    const timer = setTimeout(() => dismiss(id), VARIANT_DURATION_MS[variant]);
    timers.current.set(id, timer);
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  const value: ToastContextValue = {
    showSuccess: (message) => show(message, 'success'),
    showError: (message) => show(message, 'error'),
    showInfo: (message) => show(message, 'info'),
    showWarning: (message) => show(message, 'warning'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast"
            role={toast.variant === 'error' ? 'alert' : 'status'}
            style={{ backgroundColor: VARIANT_COLOR[toast.variant] }}
          >
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
