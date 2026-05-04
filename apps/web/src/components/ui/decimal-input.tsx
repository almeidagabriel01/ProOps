"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DecimalInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string | number;
  onChange: (value: number) => void;
  decimals?: number;
}

const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ className, value, onChange, name, decimals = 2, ...props }, ref) => {
    const [rawValue, setRawValue] = React.useState<string>("");

    React.useEffect(() => {
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(numValue) && numValue > 0) {
        const factor = Math.pow(10, decimals);
        const intValue = Math.round(numValue * factor);
        setRawValue(intValue.toString());
      } else if (value === "" || value === 0 || value === "0") {
        setRawValue("");
      }
    }, [value, decimals]);

    const getDisplayValue = (): string => {
      if (!rawValue) return (0).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

      const intValue = parseInt(rawValue, 10);
      if (isNaN(intValue)) return (0).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

      const factor = Math.pow(10, decimals);
      const decimalValue = intValue / factor;

      return decimalValue.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };

    const commitValue = (val: string) => {
      setRawValue(val);
      const intValue = val ? parseInt(val, 10) : 0;
      const factor = Math.pow(10, decimals);
      const decimalValue = intValue / factor;
      onChange(decimalValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const newRaw = inputValue.replace(/\D/g, "");
      commitValue(newRaw);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ([8, 46, 9, 27, 13, 37, 38, 39, 40].includes(e.keyCode)) {
        if (e.keyCode === 8 || e.keyCode === 46) {
          e.preventDefault();
          const newRaw = rawValue.slice(0, -1);
          commitValue(newRaw);
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
        const newRaw = (rawValue === "0" ? "" : rawValue) + digit;
        commitValue(newRaw);
        return;
      }

      // Prevent other keys
      e.preventDefault();
    };

    return (
      <input
        type="text"
        inputMode="numeric"
        className={cn(
          "h-8 rounded-md border bg-background px-2 text-center text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20",
          className
        )}
        ref={ref}
        name={name}
        value={getDisplayValue()}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);
DecimalInput.displayName = "DecimalInput";

export { DecimalInput };
