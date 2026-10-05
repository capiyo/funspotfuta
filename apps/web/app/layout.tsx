import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from './provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-fan-background text-fan-textPrimary antialiased">
        <AuthProvider>
          <ToastProvider>
            <QueryProvider>{children}</QueryProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}