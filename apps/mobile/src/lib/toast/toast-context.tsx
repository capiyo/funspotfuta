// RN adaptation of funspot/lib/services/toast_helper.dart — same 4
// variants/colors/durations as the web port
// (funspot-next/lib/toast/toast-context.tsx), rendered as a native
// Animated.View overlay instead of a fixed DOM div.

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  opacity: Animated.Value;
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

  const show = useCallback((message: string, variant: ToastVariant) => {
    const id = nextId++;
    const opacity = new Animated.Value(0);
    setToasts((prev) => [...prev, { id, message, variant, opacity }]);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      });
    }, VARIANT_DURATION_MS[variant]);
    timers.current.set(id, timer);
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
      <View pointerEvents="none" style={styles.container}>
        {toasts.map((t) => (
          <Animated.View
            key={t.id}
            style={[styles.toast, { backgroundColor: VARIANT_COLOR[t.variant], opacity: t.opacity }]}
          >
            <Text style={styles.text}>{t.message}</Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  toast: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
    maxWidth: '85%',
  },
  text: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
