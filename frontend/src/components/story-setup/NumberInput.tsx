import React, { useMemo } from 'react';
import FormField from '@/components/story-setup/FormField';

interface NumberInputProps {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  required?: boolean;
  helperText?: string;
  tooltip?: string;
  error?: string;
  success?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function NumberInput({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  required,
  helperText,
  tooltip,
  error,
  success,
  disabled,
  onChange,
  onBlur,
}: NumberInputProps) {
  const numericValue = Number(value);
  const resolvedValue = Number.isFinite(numericValue) ? numericValue : min;
  const isAtMin = resolvedValue <= min;
  const isAtMax = resolvedValue >= max;

  const rangeLabel = useMemo(() => `Min: ${min}  Max: ${max}`, [min, max]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.replace(/[^0-9]/g, '');
    onChange(next);
  };

  const handleBlur = () => {
    if (!value.trim()) return;
    const clamped = clamp(resolvedValue, min, max);
    if (clamped !== resolvedValue) {
      onChange(String(clamped));
    }
    onBlur?.();
  };

  const handleStep = (direction: 'down' | 'up') => {
    const base = Number.isFinite(numericValue) ? numericValue : min;
    const nextValue = clamp(base + (direction === 'up' ? step : -step), min, max);
    onChange(String(nextValue));
  };

  const inputClassName = [
    'w-full rounded-2xl px-3 py-2 text-sm text-gray-900 focus:outline-none border transition-colors',
    disabled ? 'bg-gray-100 cursor-not-allowed border-gray-200' : 'bg-white',
    error ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200' :
      success ? 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200' :
        'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
  ].join(' ');

  return (
    <FormField
      id={id}
      label={label}
      required={required}
      optionalTag={!required}
      helperText={helperText || rangeLabel}
      tooltip={tooltip}
      error={error}
      success={success}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleStep('down')}
          className={`h-10 w-10 rounded-xl border text-lg font-semibold transition-colors ${
            isAtMin || disabled ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          disabled={isAtMin || disabled}
          aria-label={`Decrease ${label}`}
        >
          -
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-help ${id}-error`}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => handleStep('up')}
          className={`h-10 w-10 rounded-xl border text-lg font-semibold transition-colors ${
            isAtMax || disabled ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          disabled={isAtMax || disabled}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </FormField>
  );
}

