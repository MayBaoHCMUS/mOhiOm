import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: {
    default: 'mOhiOm — AI Comic Studio',
    template: '%s | mOhiOm',
  },
  description: 'AI-powered comic generation studio. Write, design, and publish comics with generative AI.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

