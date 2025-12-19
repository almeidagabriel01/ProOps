"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Phone } from "lucide-react";

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
      <div className="relative group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
          <Phone className="w-4 h-4" />
        </div>
        <input
          type="tel"
          inputMode="numeric"
          className={cn(
            "flex h-12 w-full rounded-xl border-2 border-border/60 bg-card pl-11 pr-4 py-3 text-sm",
            "shadow-sm transition-[border-color,box-shadow] duration-200 ease-out",
            "placeholder:text-muted-foreground/60",
            "hover:border-primary/40 hover:shadow-md",
            "focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10",
            "focus:ring-4 focus:ring-primary/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm",
            className
          )}
          ref={ref}
          name={name}
          value={formatPhone(value || "")}
          onChange={handleChange}
          maxLength={16}
          {...props}
        />
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
