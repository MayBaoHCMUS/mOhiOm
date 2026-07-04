import React from 'react';

interface ErrorMessageProps {
  id: string;
  message?: string;
}

export default function ErrorMessage({ id, message }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-center gap-2 text-xs text-red-600">
      <span className="material-symbols-outlined text-sm">error</span>
      {message}
    </p>
  );
}

