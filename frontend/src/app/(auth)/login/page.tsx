'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { authApi, toApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!isValidEmail(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusError(null);
    setStatusSuccess(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await authApi.login({ email: email.trim(), password });
      await refresh();
      setStatusSuccess(response.data.message || 'Signed in successfully.');

      window.setTimeout(() => {
        router.push('/studio/dashboard');
      }, 900);
    } catch (error) {
      const apiError = toApiError(error);
      setStatusError(apiError.message || 'Sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setStatusError(null);
    setStatusSuccess(null);

    try {
      const response = await authApi.oauthStart(provider, 'login');
      window.location.assign(response.data.url);
    } catch (error) {
      const apiError = toApiError(error);
      setStatusError(apiError.message || 'Unable to start OAuth sign-in.');
    }
  };

  return (
    <AuthShell
      title="Welcome back to AI Comic Studio"
      subtitle="Sign in to continue your creative journey."
      aside={
        <>
          <div className="absolute inset-0">
            <img
              className="w-full h-full object-cover"
              alt="Futuristic manga skyline"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsVq7RvA6oWBtCkZQnQUHmVLYN6630yKCtjwUsl4EJ0gbVrr6Rba-SGy8IQDSpqVynJTeoGXJBiKy-FQ1vAIH6OhjqkfBp85LqMqK6-npIdo5b6qqzN7exdO8W5n-xWbGXiB2L8SbQc9GJI3lNh_RRTs_pQSBOBAJaDAZrq5on31dI4EnIc8U1BigBVGpJRgxRXlaWCcUyn4cU-ka6JHvUHGRY5n9wx3g5leai5WSFkAxI8DtLl_bVQZQoV7HAeLib2_GdtceCuJU"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
          <div className="relative w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-2xl">
            <div className="space-y-4">
              <p className="text-on-surface text-xl font-medium leading-relaxed italic">
                AI Comic Studio has completely transformed my workflow. I can now visualize complex storyboards in
                minutes instead of days. The style consistency is unmatched.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <img
                  className="w-12 h-12 rounded-full object-cover border-2 border-outline-variant"
                  alt="Creative director portrait"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUlG0oW_ZmFawgVrZ2wQyyzmOgythczFhn4i7zRIc1pWTxW9hRl-ONWxjaimyEEexM6TVkLOkrVT1lganT6fw8ZnxSYeaFrwkL5AEQdLuUb3I2zozDsCTt1cWU4fzIg32-ffw-PFLUwi4ZS4M8sy66HDlrb309404E3axM0qRMhcMMPxdPyoYlRFBEuZ-YGg-6OK7p7q7W0wIO28-gmq9n4PrjYL-aB_FTI3lIPA9R6FQPSxaNAkutGr_EX6-SMc0yuwFZJMUUzL4"
                />
                <div>
                  <h4 className="font-bold text-on-surface">Kaito Tanaka</h4>
                  <p className="text-on-surface-variant text-sm">Lead Artist, Neo-Tokyo Collective</p>
                </div>
              </div>
            </div>
          </div>
        </>
      }
      footer={
        <div className="space-y-6 border-t border-outline-variant/30 pt-6 text-center">
          <p className="text-on-surface-variant">
            Don&apos;t have an account?{' '}
            <Link className="text-primary font-bold hover:underline underline-offset-4" href="/register">
              Sign up for free
            </Link>
          </p>
          <div className="flex items-center justify-center gap-6">
            <Link className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest hover:text-primary" href="#">
              Privacy Policy
            </Link>
            <Link className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest hover:text-primary" href="#">
              Terms of Service
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all border border-outline-variant"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span className="font-semibold text-on-surface">Continue with Google</span>
        </button>
        <button
          type="button"
          onClick={() => handleOAuth('github')}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-on-surface text-white rounded-xl hover:opacity-90 transition-all"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1.27a11 11 0 00-3.48 21.46c.55.1.75-.24.75-.53v-1.87c-3.06.67-3.7-1.48-3.7-1.48-.5-1.27-1.21-1.61-1.21-1.61-1-.68.08-.66.08-.66 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.58 1.19 3.21.91.1-.71.38-1.19.7-1.46-2.44-.28-5-1.22-5-5.42 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.91 0 0 .92-.3 3.03 1.13a10.5 10.5 0 015.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.51.22 2.63.11 2.91.71.77 1.13 1.75 1.13 2.95 0 4.21-2.56 5.13-5 5.41.39.34.74 1 .74 2.01v2.98c0 .29.2.64.76.53A11 11 0 0012 1.27z" fill="currentColor" />
          </svg>
          <span className="font-semibold">Continue with GitHub</span>
        </button>
      </div>

      <div className="relative flex items-center gap-4">
        <div className="flex-grow h-px bg-outline-variant" />
        <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest px-2">or</span>
        <div className="flex-grow h-px bg-outline-variant" />
      </div>

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {statusSuccess && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-100/60 px-4 py-3 text-sm text-emerald-800">
            {statusSuccess}
          </div>
        )}
        {statusError && (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {statusError}
          </div>
        )}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            className="w-full px-5 py-3.5 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40 outline-none"
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-xs text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-sm font-bold text-on-surface-variant uppercase tracking-widest" htmlFor="password">
              Password
            </label>
            <Link className="text-xs font-semibold text-primary hover:underline underline-offset-4" href="/forgot-password">
              Forgot?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            className="w-full px-5 py-3.5 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40 outline-none"
          />
          {fieldErrors.password && (
            <p id="password-error" className="text-xs text-red-600">
              {fieldErrors.password}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 px-6 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 ${
            isSubmitting
              ? 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
              : 'bg-gradient-to-br from-primary to-primary-container hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthShell>
  );
}
