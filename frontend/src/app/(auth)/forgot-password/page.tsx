'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { authApi, toApiError } from '@/services/api';

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    let error: string | null = null;
    if (!email.trim()) {
      error = 'Email is required.';
    } else if (!isValidEmail(email)) {
      error = 'Enter a valid email address.';
    }
    setFieldError(error);
    return !error;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusError(null);
    setStatusSuccess(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await authApi.forgotPassword({ email: email.trim() });
      setStatusSuccess(response.data.message || 'Reset link sent. Check your inbox.');
    } catch (error) {
      const apiError = toApiError(error);
      setStatusError(apiError.message || 'Request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you used to register. We'll send a reset link if the account exists."
      aside={
        <>
          <div className="absolute inset-0">
            <img
              className="w-full h-full object-cover"
              alt="Soft manga skyline"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsVq7RvA6oWBtCkZQnQUHmVLYN6630yKCtjwUsl4EJ0gbVrr6Rba-SGy8IQDSpqVynJTeoGXJBiKy-FQ1vAIH6OhjqkfBp85LqMqK6-npIdo5b6qqzN7exdO8W5n-xWbGXiB2L8SbQc9GJI3lNh_RRTs_pQSBOBAJaDAZrq5on31dI4EnIc8U1BigBVGpJRgxRXlaWCcUyn4cU-ka6JHvUHGRY5n9wx3g5leai5WSFkAxI8DtLl_bVQZQoV7HAeLib2_GdtceCuJU"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
          <div className="relative w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-2xl">
            <div className="space-y-3">
              <p className="text-on-surface text-xl font-medium leading-relaxed italic">
                Keep your creative flow going. We&apos;ll help you get back into your studio quickly.
              </p>
              <p className="text-on-surface-variant text-sm">
                If you remember your password, you can return to sign in at any time.
              </p>
            </div>
          </div>
        </>
      }
      footer={
        <div className="space-y-4 text-center">
          <p className="text-on-surface-variant">
            Remembered your password?{' '}
            <Link className="text-primary font-bold hover:underline underline-offset-4" href="/login">
              Back to sign in
            </Link>
          </p>
        </div>
      }
    >
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
          <label className="block text-sm font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="resetEmail">
            Email Address
          </label>
          <input
            id="resetEmail"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? 'reset-email-error' : undefined}
            className="w-full px-5 py-3.5 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40 outline-none"
          />
          {fieldError && (
            <p id="reset-email-error" className="text-xs text-red-600">
              {fieldError}
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
          {isSubmitting ? 'Sending link...' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  );
}
