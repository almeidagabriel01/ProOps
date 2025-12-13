import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    wrapperClassName?: string;
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, wrapperClassName, children, ...props }, ref) => {
        return (
            <div className={cn("relative group", wrapperClassName, className)}>
                <select
                    className={cn(
                        "flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-4 py-2 pr-10 text-sm",
                        "ring-offset-background transition-all duration-200",
                        "hover:border-primary/50 hover:bg-muted/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "cursor-pointer"
                    )}
                    ref={ref}
                    {...props}
                >
                    {children}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180">
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
            </div>
        )
    }
)
Select.displayName = "Select"

export { Select }
