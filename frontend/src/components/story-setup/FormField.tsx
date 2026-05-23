import React from 'react';
import ErrorMessage from '@/components/story-setup/ErrorMessage';
import HelperText from '@/components/story-setup/HelperText';
import Tooltip from '@/components/story-setup/Tooltip';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  optionalTag?: boolean;
  tooltip?: string;
  helperText?: string;
  error?: string;
  success?: boolean;
  warning?: string;
  children: React.ReactNode;
}

export default function FormField({
  id,
  label,
  required,
  optionalTag,
  tooltip,
  helperText,
  error,
  success,
  warning,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-500">
        <span>{label}</span>
        {required ? <span className="text-red-500">*</span> : null}
        {!required && optionalTag ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Optional</span>
        ) : null}
        {tooltip ? <Tooltip content={tooltip} /> : null}
      </label>

      {children}

      {warning ? <HelperText id={`${id}-warning`} text={warning} tone="warning" /> : null}
      {helperText ? <HelperText id={`${id}-help`} text={helperText} /> : null}
      <ErrorMessage id={`${id}-error`} message={error} />
      {success && !error ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-emerald-600" role="status">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          Looks good.
        </p>
      ) : null}
    </div>
  );
}

