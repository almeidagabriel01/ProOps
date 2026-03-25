import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, suffix, onChange, onFocus, ...props }, ref) => {
    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      if (type === "number" && event.currentTarget.value === "0") {
        event.currentTarget.select();
      }

      onFocus?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (type === "number") {
        const currentValue = event.target.value;
        const hasDecimalSeparator =
          currentValue.includes(".") || currentValue.includes(",");

        if (/^0\d+/.test(currentValue) && !hasDecimalSeparator) {
          const normalized = currentValue.replace(/^0+/, "") || "0";
          event.target.value = normalized;
        }
      }

      onChange?.(event);
    };

    return (
      <div className="relative group">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-xl border-2 border-border/60 bg-card px-4 py-3 text-sm",
            "shadow-sm transition-[border-color,box-shadow] duration-200 ease-out",
            "placeholder:text-muted-foreground/60",
            "hover:border-primary/40 hover:shadow-md",
            "focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm",
            icon && "pl-11",
            suffix && "pr-11",
            className,
          )}
          ref={ref}
          onFocus={handleFocus}
          onChange={handleChange}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {suffix}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
