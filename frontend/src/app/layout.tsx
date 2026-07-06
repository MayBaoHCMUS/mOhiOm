import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import OnboardingOrchestrator from '@/components/onboarding/OnboardingOrchestrator';

export const metadata: Metadata = {
  title: {
    default: 'mOhiOm — AI Comic Studio',
    template: '%s | mOhiOm',
  },
  description: 'AI-powered comic generation studio. Write, design, and publish comics with generative AI.',
  icons: {
    icon: '/favicon-icon.png',
    shortcut: '/favicon-icon.png',
    apple: '/favicon-icon.png',
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
        <AuthProvider>
          <NotificationProvider>
            <OnboardingProvider>
              {children}
              <OnboardingOrchestrator />
            </OnboardingProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

