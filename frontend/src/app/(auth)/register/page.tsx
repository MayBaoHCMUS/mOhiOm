'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { authApi, toApiError } from '@/services/api';

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const nextErrors: {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!lastName.trim()) nextErrors.lastName = 'Last name is required.';

    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!isValidEmail(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
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
      const response = await authApi.register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
      });
      setStatusSuccess(response.data.message || 'Account created successfully.');
    } catch (error) {
      const apiError = toApiError(error);
      setStatusError(apiError.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Join AI Comic Studio"
      subtitle="Experience the next generation of visual storytelling."
      aside={
        <>
          <div className="absolute inset-0">
            <img
              className="w-full h-full object-cover"
              alt="Cinematic manga illustration"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWeS23j--wTm_rtGUJniYHqBz7-bhVEZdxwcFsRtUAx76oI6U1-HATrddlCV2pH3QQ09R-nFb8Wx0Ykl-0Ys6zI6THTSewdJ_unPBWofszqHjZK-THtjyVp2k_0BCAEzSAJArg47ug0NIuDiByReBdMX6Mf1aOfq4L-u7JjBHYFh_zuEyD47WsvcOuC7H3jJrZdtCB7v6URYQ5lya84aAT4FTlsNDJeCEfftr8tNl0KQIFXgPgHQhmXC5c5ko9zSt0tQ1BS5LZavQ"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 via-transparent to-transparent" />
          </div>
          <div className="relative w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-2xl">
            <div className="flex gap-1 mb-4 text-secondary-fixed">
              {Array.from({ length: 5 }).map((_, index) => (
                <span key={index} className="text-lg">★</span>
              ))}
            </div>
            <p className="text-on-surface text-xl font-medium leading-relaxed mb-6 italic">
              “AI Comic Studio transformed my workflow. I can now visualize complex storyboards in minutes instead of
              weeks. It&apos;s an essential tool for the modern creator.”
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-outline-variant">
                <img
                  className="w-full h-full object-cover"
                  alt="Professional comic artist portrait"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4G9WUGy6OF6xQRo96oDdJE-DYzbKeXoXiAE-CtoroGcypxPOhKDl6D5GT5_h1DaVqRbugKDub3iiqIMrkWc0FyEle-8p4AL-4fq7JlqvN9ZRcKrsUCHFo6GWM8aXpwCRnwlMsSXUPMbP_UyFnyXp66y8RODbh0G3Gk5TD-rWHxp2o0ut6sC9E8FA5mOxPTD_d8JbPVTe2Hy0mFnck9ZWb8CY8P0p8PtFUe2Yic8OTEPv2wnhCmZhmbGqronte-bFKnfGb1j7G-vw"
                />
              </div>
              <div>
                <h4 className="font-bold text-on-surface">Marcus Thorne</h4>
                <p className="text-on-surface-variant text-sm">Lead Artist, Ethereal Studios</p>
              </div>
            </div>
          </div>
        </>
      }
      footer={
        <div className="space-y-4 text-center">
          <p className="text-on-surface-variant">
            Already have an account?{' '}
            <Link className="text-primary font-bold hover:underline underline-offset-4 decoration-2" href="/login">
              Log in
            </Link>
          </p>
          <div className="flex justify-center gap-6 pt-4">
            <Link className="text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary" href="#">
              Privacy Policy
            </Link>
            <Link className="text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary" href="#">
              Terms of Service
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all border border-outline-variant"
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
          className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-on-surface text-white hover:opacity-90 transition-all"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          <span className="font-semibold">Continue with GitHub</span>
        </button>
      </div>

      <div className="relative flex items-center gap-4">
        <div className="flex-grow h-px bg-outline-variant" />
        <span className="text-sm uppercase tracking-widest text-on-surface-variant">or</span>
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
          <label className="text-sm uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="firstName">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="E.g. Sora"
            aria-invalid={Boolean(fieldErrors.firstName)}
            aria-describedby={fieldErrors.firstName ? 'first-name-error' : undefined}
            className="w-full px-5 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-300 placeholder:text-on-surface-variant/40"
          />
          {fieldErrors.firstName && (
            <p id="first-name-error" className="text-xs text-red-600">
              {fieldErrors.firstName}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="lastName">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Akita"
            aria-invalid={Boolean(fieldErrors.lastName)}
            aria-describedby={fieldErrors.lastName ? 'last-name-error' : undefined}
            className="w-full px-5 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-300 placeholder:text-on-surface-variant/40"
          />
          {fieldErrors.lastName && (
            <p id="last-name-error" className="text-xs text-red-600">
              {fieldErrors.lastName}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="registerEmail">
            Email
          </label>
          <input
            id="registerEmail"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
            className="w-full px-5 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-300 placeholder:text-on-surface-variant/40"
          />
          {fieldErrors.email && (
            <p id="register-email-error" className="text-xs text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="registerPassword">
            Password
          </label>
          <input
            id="registerPassword"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Min. 8 characters"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
            className="w-full px-5 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-300 placeholder:text-on-surface-variant/40"
          />
          {fieldErrors.password && (
            <p id="register-password-error" className="text-xs text-red-600">
              {fieldErrors.password}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat your password"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
            className="w-full px-5 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-300 placeholder:text-on-surface-variant/40"
          />
          {fieldErrors.confirmPassword && (
            <p id="confirm-password-error" className="text-xs text-red-600">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 px-6 text-white font-bold rounded-xl shadow-xl shadow-primary/20 transition-all duration-300 ${
            isSubmitting
              ? 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
              : 'bg-gradient-to-br from-primary to-primary-container hover:scale-[1.02] active:scale-95'
          }`}
        >
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </AuthShell>
  );
}
