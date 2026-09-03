import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/lib/toast/toast-context';

export const metadata: Metadata = {
  title: 'Funspot — Where Champions Are Crowned',
  description: 'Funspot is a war zone for fans: create channels, vote on matches, and earn.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-funspot-bg antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
