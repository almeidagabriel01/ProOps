"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  prefixSymbol?: string;
}

const formatCents = (raw: string): string => {
  if (!raw) return "";
  const cents = parseInt(raw, 10);
  if (isNaN(cents)) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Count digits before a given cursor position in the display string
const cursorToDigitIndex = (display: string, cursorPos: number): number => {
  let count = 0;
  for (let i = 0; i < cursorPos && i < display.length; i++) {
    if (/\d/.test(display[i])) count++;
  }
  return count;
};

// Map digit index back to display cursor position (after the nth digit)
const digitIndexToDisplayPos = (display: string, n: number): number => {
  if (n === 0) return 0;
  let count = 0;
  for (let i = 0; i < display.length; i++) {
    if (/\d/.test(display[i])) {
      count++;
      if (count === n) return i + 1;
    }
  }
  return display.length;
};

// Display digits that have no counterpart in rawValue (e.g. "0,02" → 2 leading zeros for raw "2").
// These are always at the front of the display and shift the digit-index ↔ raw-index mapping.
const getLeadingZeros = (raw: string, display: string): number => {
  return Math.max(0, display.replace(/\D/g, "").length - raw.length);
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, name, prefixSymbol = "R$", onKeyDown: externalOnKeyDown, onPaste: externalOnPaste, ...props }, ref) => {
    const [rawValue, setRawValue] = React.useState<string>("");
    const internalRef = React.useRef<HTMLInputElement>(null);

    const setRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        (internalRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref]
    );

    React.useEffect(() => {
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(numValue) && numValue > 0) {
        const centsValue = Math.round(numValue * 100);
        setRawValue(centsValue.toString());
      } else if (value === "" || value === 0 || value === "0") {
        setRawValue("");
      }
    }, [value]);

    const fireChange = (newRaw: string) => {
      const centsValue = newRaw ? parseInt(newRaw, 10) : 0;
      const decimalValue = centsValue / 100;
      onChange({
        target: {
          name: name || "",
          value: newRaw ? String(decimalValue) : "",
        },
      } as React.ChangeEvent<HTMLInputElement>);
    };

    // newRawCursorPos: position within the raw digit sequence (0 = before first raw digit)
    const applyEdit = (newRaw: string, newRawCursorPos: number) => {
      setRawValue(newRaw);
      requestAnimationFrame(() => {
        const inp = internalRef.current;
        if (inp) {
          const newDisplay = formatCents(newRaw);
          const newLeadingZeros = getLeadingZeros(newRaw, newDisplay);
          const pos = digitIndexToDisplayPos(newDisplay, newLeadingZeros + newRawCursorPos);
          inp.setSelectionRange(pos, pos);
        }
      });
      fireChange(newRaw);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ([9, 27, 13, 37, 38, 39, 40].includes(e.keyCode)) return;
      if ((e.ctrlKey || e.metaKey) && ["a", "c"].includes(e.key.toLowerCase())) return;

      const isBackspace = e.keyCode === 8;
      const isDelete = e.keyCode === 46;
      const isDigit =
        (e.keyCode >= 48 && e.keyCode <= 57) ||
        (e.keyCode >= 96 && e.keyCode <= 105);
      const isCut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x";

      if (!isBackspace && !isDelete && !isDigit && !isCut) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      const input = e.currentTarget;
      const selStart = input.selectionStart ?? 0;
      const selEnd = input.selectionEnd ?? 0;
      const hasSelection = selStart !== selEnd;
      const display = formatCents(rawValue);

      // How many display digits appear before the cursor
      const startDigit = cursorToDigitIndex(display, selStart);
      const endDigit = hasSelection ? cursorToDigitIndex(display, selEnd) : startDigit;

      // Subtract leading zeros to get cursor position within rawValue.
      // Clamp to 0: cursor placed in the leading-zero area maps to raw position 0.
      const leadingZeros = getLeadingZeros(rawValue, display);
      const startRawDigit = Math.max(0, startDigit - leadingZeros);
      const endRawDigit = Math.max(0, endDigit - leadingZeros);

      if (isDigit) {
        const digit = e.key;
        const newRaw = rawValue.slice(0, startRawDigit) + digit + rawValue.slice(endRawDigit);
        applyEdit(newRaw, startRawDigit + 1);
      } else if (isBackspace) {
        if (hasSelection) {
          applyEdit(rawValue.slice(0, startRawDigit) + rawValue.slice(endRawDigit), startRawDigit);
        } else if (startRawDigit > 0) {
          applyEdit(rawValue.slice(0, startRawDigit - 1) + rawValue.slice(startRawDigit), startRawDigit - 1);
        }
      } else if (isDelete) {
        if (hasSelection) {
          applyEdit(rawValue.slice(0, startRawDigit) + rawValue.slice(endRawDigit), startRawDigit);
        } else if (startRawDigit < rawValue.length) {
          applyEdit(rawValue.slice(0, startRawDigit) + rawValue.slice(startRawDigit + 1), startRawDigit);
        }
      } else if (isCut) {
        if (hasSelection) {
          const selected = display.slice(selStart, selEnd);
          navigator.clipboard?.writeText(selected).catch(() => {});
          applyEdit(rawValue.slice(0, startRawDigit) + rawValue.slice(endRawDigit), startRawDigit);
        }
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const digits = e.clipboardData.getData("text").replace(/\D/g, "");
      if (!digits) return;

      const input = e.currentTarget;
      const selStart = input.selectionStart ?? 0;
      const selEnd = input.selectionEnd ?? 0;
      const hasSelection = selStart !== selEnd;
      const display = formatCents(rawValue);

      const startDigit = cursorToDigitIndex(display, selStart);
      const endDigit = hasSelection ? cursorToDigitIndex(display, selEnd) : startDigit;

      const leadingZeros = getLeadingZeros(rawValue, display);
      const startRawDigit = Math.max(0, startDigit - leadingZeros);
      const endRawDigit = Math.max(0, endDigit - leadingZeros);

      const newRaw = rawValue.slice(0, startRawDigit) + digits + rawValue.slice(endRawDigit);
      applyEdit(newRaw, startRawDigit + digits.length);
    };

    return (
      <div className="relative group">
        {prefixSymbol && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors text-sm font-medium">
            {prefixSymbol}
          </span>
        )}
        <input
          type="text"
          inputMode="numeric"
          className={cn(
            "flex h-12 w-full rounded-xl border-2 border-border/60 bg-card pr-4 py-3 text-sm",
            prefixSymbol ? "pl-11" : "pl-4",
            "shadow-sm transition-[border-color,box-shadow] duration-200 ease-out",
            "placeholder:text-muted-foreground/60",
            "hover:border-primary/40 hover:shadow-md",
            "focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            className
          )}
          ref={setRef}
          name={name}
          value={formatCents(rawValue)}
          onChange={() => {}}
          onKeyDown={(e) => { handleKeyDown(e); externalOnKeyDown?.(e); }}
          onPaste={(e) => { handlePaste(e); externalOnPaste?.(e); }}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
