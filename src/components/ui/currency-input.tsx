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
 * Formats as user types treating input as cents:
 * - "1" becomes "0,01" (1 cent)
 * - "100" becomes "1,00" (1 real)
 * - "12345" becomes "123,45"
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, name, ...props }, ref) => {
    const [rawValue, setRawValue] = React.useState<string>("");

    React.useEffect(() => {
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(numValue) && numValue > 0) {
        const centsValue = Math.round(numValue * 100);
        setRawValue(centsValue.toString());
      } else if (value === "" || value === 0 || value === "0") {
        setRawValue("");
      }
    }, [value]);

    const getDisplayValue = (): string => {
      if (!rawValue) return "";

      const centsValue = parseInt(rawValue, 10);
      if (isNaN(centsValue)) return "";

      const decimalValue = centsValue / 100;

      return decimalValue.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      const newRaw = inputValue.replace(/\D/g, "");

      setRawValue(newRaw);

      const centsValue = newRaw ? parseInt(newRaw, 10) : 0;
      const decimalValue = centsValue / 100;

      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          name: name || "",
          value: newRaw ? String(decimalValue) : "",
        },
      } as React.ChangeEvent<HTMLInputElement>;

      onChange(syntheticEvent);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ([8, 46, 9, 27, 13, 37, 38, 39, 40].includes(e.keyCode)) {
        if (e.keyCode === 8 || e.keyCode === 46) {
          e.preventDefault();
          const newRaw = rawValue.slice(0, -1);
          setRawValue(newRaw);

          const centsValue = newRaw ? parseInt(newRaw, 10) : 0;
          const decimalValue = centsValue / 100;

          const syntheticEvent = {
            target: {
              name: name || "",
              value: newRaw ? String(decimalValue) : "",
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

        const centsValue = parseInt(newRaw, 10);
        const decimalValue = centsValue / 100;

        const syntheticEvent = {
          target: {
            name: name || "",
            value: String(decimalValue),
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
