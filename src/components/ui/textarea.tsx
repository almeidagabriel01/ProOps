import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[140px] w-full rounded-xl border-2 border-border/60 bg-card px-4 py-3.5 text-sm",
          "shadow-sm transition-[border-color,box-shadow] duration-200 ease-out resize-y",
          "placeholder:text-muted-foreground/60",
          "hover:border-primary/40 hover:shadow-md",
          "focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:shadow-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
