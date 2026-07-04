import { useCallback, useMemo, useState } from 'react';
import type { FieldConfig, ValidationErrors } from '@/components/story-setup/types';

const isEmpty = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (value instanceof File) return false;
  if (value === null || value === undefined) return true;
  return false;
};

export const useFormValidation = <T extends Record<string, unknown>>(
  formData: T,
  fieldConfigs: Array<FieldConfig>
) => {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateField = useCallback(
    (name: keyof T, value: unknown) => {
      const config = fieldConfigs.find((field) => field.name === name);
      if (!config) return undefined;
      const error = config.validation(value);
      setErrors((prev) => ({ ...prev, [name as string]: error }));
      return error;
    },
    [fieldConfigs]
  );

  const handleBlur = useCallback(
    (name: keyof T) => {
      setTouched((prev) => ({ ...prev, [name as string]: true }));
      return validateField(name, formData[name]);
    },
    [formData, validateField]
  );

  const handleChange = useCallback(
    (name: keyof T, value: unknown) => {
      if (!touched[name as string]) return;
      validateField(name, value);
    },
    [touched, validateField]
  );

  const validateAll = useCallback(() => {
    const nextErrors: ValidationErrors = {};
    fieldConfigs.forEach((config) => {
      const value = formData[config.name as keyof T];
      const error = config.validation(value);
      nextErrors[config.name as string] = error;
    });
    setErrors(nextErrors);
    const nextTouched = fieldConfigs.reduce<Record<string, boolean>>((acc, config) => {
      acc[config.name as string] = true;
      return acc;
    }, {});
    setTouched(nextTouched);
    return nextErrors;
  }, [fieldConfigs, formData]);

  const computedErrors = useMemo(() => {
    return fieldConfigs.reduce<ValidationErrors>((acc, config) => {
      const value = formData[config.name as keyof T];
      acc[config.name as string] = config.validation(value);
      return acc;
    }, {});
  }, [fieldConfigs, formData]);

  const errorCount = useMemo(() => Object.values(errors).filter(Boolean).length, [errors]);

  const requiredTotal = useMemo(() => fieldConfigs.filter((field) => field.required).length, [fieldConfigs]);

  const requiredComplete = useMemo(() => {
    return fieldConfigs
      .filter((field) => field.required)
      .filter((field) => {
        const value = formData[field.name as keyof T];
        return !isEmpty(value) && !computedErrors[field.name as string];
      }).length;
  }, [computedErrors, fieldConfigs, formData]);

  const isValid = useMemo(() => {
    return fieldConfigs.every((field) => {
      const value = formData[field.name as keyof T];
      if (field.required && isEmpty(value)) return false;
      return !computedErrors[field.name as string];
    });
  }, [computedErrors, fieldConfigs, formData]);

  return {
    errors,
    touched,
    errorCount,
    requiredTotal,
    requiredComplete,
    isValid,
    validateField,
    validateAll,
    handleBlur,
    handleChange,
  };
};
