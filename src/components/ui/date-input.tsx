"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

export interface DateInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type"
> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Stylized date input with calendar icon on the right
 */
const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value, onChange, name, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Merge refs
    React.useImperativeHandle(ref, () => inputRef.current!);

    const handleIconClick = () => {
      // Trigger the native date picker
      inputRef.current?.showPicker?.();
      inputRef.current?.focus();
    };

    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Custom styles to hide the default calendar icon in some browsers
            "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
            className
          )}
          name={name}
          value={value}
          onChange={onChange}
          min="1900-01-01"
          max="9999-12-31"
          {...props}
        />
        <button
          type="button"
          onClick={handleIconClick}
          className={cn(
            "absolute right-0 top-0 h-full px-3 flex items-center justify-center",
            "text-muted-foreground hover:text-foreground transition-colors",
            "pointer-events-auto cursor-pointer"
          )}
          tabIndex={-1}
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };
