import { Loader2, LucideProps } from "lucide-react"
import { cn } from "@/lib/utils"

interface SpinnerProps extends LucideProps {
    className?: string
}

export function Spinner({ className, ...props }: SpinnerProps) {
    return (
        <Loader2
            className={cn("h-4 w-4 animate-spin text-muted-foreground", className)}
            {...props}
        />
    )
}
