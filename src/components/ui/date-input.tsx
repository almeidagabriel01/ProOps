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
      <div className="relative group">
        <input
          ref={inputRef}
          type="date"
          className={cn(
            "flex h-12 w-full rounded-xl border-2 border-border/60 bg-card px-4 py-3 pr-12 text-sm",
            "shadow-sm transition-all duration-300 ease-out",
            "placeholder:text-muted-foreground/60",
            "hover:border-primary/40 hover:shadow-md",
            "focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10",
            "focus:ring-4 focus:ring-primary/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm",
            // Custom styles to hide the default calendar icon in some browsers
            "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
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
            "absolute right-3.5 top-1/2 -translate-y-1/2",
            "text-muted-foreground group-focus-within:text-primary transition-colors",
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
