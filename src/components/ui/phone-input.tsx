"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PhoneInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Phone input with Brazilian formatting mask: (XX) XXXXX-XXXX
 */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, name, ...props }, ref) => {
    // Format phone number as user types
    const formatPhone = (val: string): string => {
      // Remove all non-digits
      const digits = val.replace(/\D/g, "");

      // Apply mask: (XX) XXXXX-XXXX
      if (digits.length === 0) return "";
      if (digits.length <= 2) return `(${digits}`;
      if (digits.length <= 7)
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      if (digits.length <= 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }
      // Max 11 digits
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formatted = formatPhone(inputValue);

      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          name: name || "",
          value: formatted,
        },
      } as React.ChangeEvent<HTMLInputElement>;

      onChange(syntheticEvent);
    };

    return (
      <input
        type="tel"
        inputMode="numeric"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        name={name}
        value={formatPhone(value || "")}
        onChange={handleChange}
        maxLength={16}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
