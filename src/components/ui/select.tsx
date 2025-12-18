import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
  blurOnChange?: boolean;
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      wrapperClassName,
      children,
      onChange,
      blurOnChange = true,
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (blurOnChange) {
        e.target.blur();
      }
      onChange?.(e);
    };

    return (
      <div className={cn("relative group", wrapperClassName, className)}>
        <select
          className={cn(
            "flex h-12 w-full appearance-none rounded-xl border-2 border-border/60 px-4 py-3 pr-12 text-sm",
            "shadow-sm transition-all duration-300 ease-out cursor-pointer",
            "hover:border-primary/40 hover:shadow-md",
            "focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10",
            "focus:ring-4 focus:ring-primary/10",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm"
          )}
          ref={ref}
          onChange={handleChange}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
          <ChevronDown className="h-5 w-5" />
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
