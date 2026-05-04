"use client";

import * as React from "react";
import { z } from "zod";

// ============================================
// FORM VALIDATION HOOK
// ============================================

export type FormErrors<T> = Partial<Record<keyof T, string>>;

interface UseFormValidationOptions<T extends z.ZodObject<z.ZodRawShape>> {
  schema: T;
}

interface UseFormValidationReturn<T extends z.ZodObject<z.ZodRawShape>> {
  errors: FormErrors<z.infer<T>>;
  validateField: (name: keyof z.infer<T>, value: unknown, currentData: Partial<z.infer<T>>) => string | undefined;
  validateForm: (data: z.infer<T>) => boolean;
  clearErrors: () => void;
  clearFieldError: (name: keyof z.infer<T>) => void;
  setFieldError: (name: keyof z.infer<T>, message: string) => void;
}

/**
 * Hook for form validation using Zod schemas
 * Supports real-time validation (onBlur/onChange) and full form validation (onSubmit)
 */
export function useFormValidation<T extends z.ZodObject<z.ZodRawShape>>({
  schema,
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  type FormData = z.infer<T>;
  const [errors, setErrors] = React.useState<FormErrors<FormData>>({});

  /**
   * Validate a single field by validating the entire form and extracting the field error
   * Returns error message if invalid, undefined if valid
   */
  const validateField = React.useCallback(
    (name: keyof FormData, value: unknown, currentData: Partial<FormData>): string | undefined => {
      // Create a temp object with just this field updated
      const testData = { ...currentData, [name]: value };
      
      // Validate the entire schema
      const result = schema.safeParse(testData);
      
      if (result.success) {
        // Clear error for this field if valid
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
        return undefined;
      } else {
        // Find error for this specific field
        const fieldError = result.error.issues.find(
          (issue) => issue.path[0] === name
        );
        
        if (fieldError) {
          setErrors((prev) => ({
            ...prev,
            [name]: fieldError.message,
          }));
          return fieldError.message;
        } else {
          // No error for this field
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
          });
          return undefined;
        }
      }
    },
    [schema]
  );

  /**
   * Validate entire form
   * Returns true if valid, false if invalid
   */
  const validateForm = React.useCallback(
    (data: FormData): boolean => {
      const result = schema.safeParse(data);
      
      if (result.success) {
        setErrors({});
        return true;
      } else {
        const newErrors: FormErrors<FormData> = {};
        result.error.issues.forEach((issue) => {
          const path = issue.path[0] as keyof FormData;
          if (path && !newErrors[path]) {
            newErrors[path] = issue.message;
          }
        });
        setErrors(newErrors);
        return false;
      }
    },
    [schema]
  );

  /**
   * Clear all errors
   */
  const clearErrors = React.useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Clear error for a specific field
   */
  const clearFieldError = React.useCallback((name: keyof FormData) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, []);

  /**
   * Set error for a specific field (useful for backend errors)
   */
  const setFieldError = React.useCallback(
    (name: keyof FormData, message: string) => {
      setErrors((prev) => ({
        ...prev,
        [name]: message,
      }));
    },
    []
  );

  return {
    errors,
    validateField,
    validateForm,
    clearErrors,
    clearFieldError,
    setFieldError,
  };
}


