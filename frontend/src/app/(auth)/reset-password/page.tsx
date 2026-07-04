'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { authApi, toApiError } from '@/services/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const email = useMemo(() => searchParams.get('email') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
	if (!email || !token) {
	  setFieldError('Invalid or missing reset link.');
	  return false;
	}

	if (!password) {
	  setFieldError('Password is required.');
	  return false;
	}

	if (password.length < 8) {
	  setFieldError('Password must be at least 8 characters.');
	  return false;
	}

	if (password !== confirmPassword) {
	  setFieldError('Passwords do not match.');
	  return false;
	}

	setFieldError(null);
	return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
	event.preventDefault();
	setStatusError(null);
	setStatusSuccess(null);

	if (!validate()) return;

	setIsSubmitting(true);
	try {
	  const response = await authApi.resetPassword({ email, token, password });
	  setStatusSuccess(response.data.message || 'Password updated. You can sign in now.');
	  window.setTimeout(() => {
		router.push('/login');
	  }, 1200);
	} catch (error) {
	  const apiError = toApiError(error);
	  setStatusError(apiError.message || 'Reset failed.');
	} finally {
	  setIsSubmitting(false);
	}
  };

  return (
	<AuthShell
	  title="Set a new password"
	  subtitle="Choose a new password for your account."
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
		{fieldError && (
		  <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
			{fieldError}
		  </div>
		)}
		<div className="space-y-2">
		  <label className="block text-sm font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="newPassword">
			New password
		  </label>
		  <input
			id="newPassword"
			name="newPassword"
			type="password"
			value={password}
			onChange={(event) => setPassword(event.target.value)}
			placeholder="Min. 8 characters"
			className="w-full px-5 py-3.5 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40 outline-none"
		  />
		</div>
		<div className="space-y-2">
		  <label className="block text-sm font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="confirmPassword">
			Confirm password
		  </label>
		  <input
			id="confirmPassword"
			name="confirmPassword"
			type="password"
			value={confirmPassword}
			onChange={(event) => setConfirmPassword(event.target.value)}
			placeholder="Repeat your password"
			className="w-full px-5 py-3.5 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/40 outline-none"
		  />
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
		  {isSubmitting ? 'Updating...' : 'Update password'}
		</button>
	  </form>
	</AuthShell>
  );
}

