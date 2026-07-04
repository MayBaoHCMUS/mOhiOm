'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { useAuth } from '@/context/AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<'success' | 'error' | 'working'>('working');
  const [message, setMessage] = useState('Finishing sign-in...');

  const provider = useMemo(() => searchParams.get('provider'), [searchParams]);
  const mode = useMemo(() => searchParams.get('mode'), [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const user = await refresh();
      if (!isMounted) return;

      if (!user) {
        setStatus('error');
        setMessage('Sign-in could not be completed. Please try again.');
        return;
      }

      setStatus('success');
      setMessage(`Signed in with ${provider || 'OAuth'}${mode ? ` (${mode})` : ''}. Redirecting...`);
      window.setTimeout(() => {
        router.push('/studio');
      }, 1200);
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, [provider, mode, router, refresh]);

  return (
    <AuthShell
      title="Finalizing your sign-in"
      subtitle="Hang tight while we prepare your studio."
    >
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
        <p className="text-lg font-semibold text-on-surface">{message}</p>
        {status === 'error' && (
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white"
          >
            Back to sign in
          </button>
        )}
      </div>
    </AuthShell>
  );
}

