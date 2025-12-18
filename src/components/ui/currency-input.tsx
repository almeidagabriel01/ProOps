"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Currency input with Brazilian Real formatting (R$ X.XXX,XX)
 * Formats as user types - "10" becomes "10,00", "1000" becomes "1.000,00"
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, name, ...props }, ref) => {
    // Track the raw integer value (without formatting)
    const [rawValue, setRawValue] = React.useState<string>("");

    // Sync rawValue with prop value on mount and when value changes externally
    React.useEffect(() => {
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(numValue) && numValue > 0) {
        setRawValue(Math.floor(numValue).toString());
      } else if (value === "" || value === 0 || value === "0") {
        setRawValue("");
      }
    }, [value]);

    // Format the raw value for display
    const getDisplayValue = (): string => {
      if (!rawValue) return "";

      const intValue = parseInt(rawValue, 10);
      if (isNaN(intValue)) return "";

      // Format with thousand separators and add ,00
      return intValue.toLocaleString("pt-BR") + ",00";
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Remove all non-digits
      const newRaw = inputValue.replace(/\D/g, "");

      // Update raw value (this is what we track)
      setRawValue(newRaw);

      // Parse to number for the form
      const numericValue = newRaw ? parseInt(newRaw, 10) : 0;

      // Create synthetic event with numeric value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          name: name || "",
          value: newRaw ? String(numericValue) : "",
        },
      } as React.ChangeEvent<HTMLInputElement>;

      onChange(syntheticEvent);
    };

    // Handle keyboard input to manage cursor properly
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow: backspace, delete, tab, escape, enter, arrows
      if ([8, 46, 9, 27, 13, 37, 38, 39, 40].includes(e.keyCode)) {
        if (e.keyCode === 8 || e.keyCode === 46) {
          // Backspace or Delete: remove last digit from rawValue
          e.preventDefault();
          const newRaw = rawValue.slice(0, -1);
          setRawValue(newRaw);

          const numericValue = newRaw ? parseInt(newRaw, 10) : 0;

          const syntheticEvent = {
            target: {
              name: name || "",
              value: newRaw ? String(numericValue) : "",
            },
          } as React.ChangeEvent<HTMLInputElement>;

          onChange(syntheticEvent);
        }
        return;
      }

      // Allow numbers
      if (
        (e.keyCode >= 48 && e.keyCode <= 57) ||
        (e.keyCode >= 96 && e.keyCode <= 105)
      ) {
        e.preventDefault();
        const digit = e.key;
        const newRaw = rawValue + digit;
        setRawValue(newRaw);

        const numericValue = parseInt(newRaw, 10);

        const syntheticEvent = {
          target: {
            name: name || "",
            value: String(numericValue),
          },
        } as React.ChangeEvent<HTMLInputElement>;

        onChange(syntheticEvent);
        return;
      }

      // Prevent other keys
      e.preventDefault();
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          R$
        </span>
        <input
          type="text"
          inputMode="numeric"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            className
          )}
          ref={ref}
          name={name}
          value={getDisplayValue()}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
