import { cn } from "@/lib/utils"
import { Loader } from "@/components/ui/loader"

interface SpinnerProps {
    className?: string
}

export function Spinner({ className }: SpinnerProps) {
    return <Loader size="sm" variant="inline" className={cn(className)} />
}
