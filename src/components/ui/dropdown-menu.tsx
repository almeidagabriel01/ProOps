"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
    children: React.ReactNode
}

const DropdownMenuContext = React.createContext<{
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
}>({
    open: false,
    setOpen: () => { }
})

export function DropdownMenu({ children }: DropdownMenuProps) {
    const [open, setOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [open])

    return (
        <DropdownMenuContext.Provider value={{ open, setOpen }}>
            <div className="relative inline-block text-left" ref={containerRef}>
                {children}
            </div>
        </DropdownMenuContext.Provider>
    )
}

export function DropdownMenuTrigger({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) {
    const { open, setOpen } = React.useContext(DropdownMenuContext)

    if (asChild) {
        // Clone element to attach onClick
        const child = React.Children.only(children) as React.ReactElement<{ onClick?: React.MouseEventHandler }>
        return React.cloneElement(child, {
            onClick: (e: React.MouseEvent) => {
                // Determine if we should stop prop? maybe
                if (child.props && typeof child.props.onClick === 'function') {
                    child.props.onClick(e)
                }
                setOpen(!open)
            }
        })
    }

    return (
        <button onClick={() => setOpen(!open)}>
            {children}
        </button>
    )
}

export function DropdownMenuContent({ children, className, align = "center" }: { children: React.ReactNode, className?: string, align?: "start" | "center" | "end", forceMount?: boolean }) {
    const { open } = React.useContext(DropdownMenuContext)

    if (!open) return null

    const alignmentClasses = {
        start: "left-0",
        center: "left-1/2 -translate-x-1/2",
        end: "right-0"
    }

    return (
        <div className={cn(
            "absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            alignmentClasses[align],
            className
        )}>
            {children}
        </div>
    )
}

export function DropdownMenuItem({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) {
    const { setOpen } = React.useContext(DropdownMenuContext)

    return (
        <div
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
                className
            )}
            onClick={() => {
                onClick?.()
                setOpen(false)
            }}
        >
            {children}
        </div>
    )
}

export function DropdownMenuLabel({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>{children}</div>
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
    return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
}
