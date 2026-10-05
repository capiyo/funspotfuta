import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from './provider';

// Same two font families as FanTypography (DM Sans for body/UI text,
// Saira Condensed for scores/headlines). Loaded via a <link> tag rather
// than next/font/google: next/font fetches the font at BUILD time,
// which fails in network-restricted build environments (sandboxes, some
// CI runners); a <link> tag fetches at runtime in the browser instead,
// which is both more portable and closer to how a Flutter web build
// includes web fonts (a <link> in index.html).
export const metadata: Metadata = {
  title: 'Funspot — Where Champions Are Crowned',
  description: 'Funspot is a war zone for fans: create channels, vote on matches, and earn.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Saira+Condensed:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
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