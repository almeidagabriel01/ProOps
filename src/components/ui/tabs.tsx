"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
    value: string
    onChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
    const context = React.useContext(TabsContext)
    if (!context) {
        throw new Error("Tabs components must be used within a Tabs provider")
    }
    return context
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: string
    onValueChange?: (value: string) => void
    defaultValue?: string
}

export function Tabs({ value: controlledValue, onValueChange, defaultValue, className, children, ...props }: TabsProps) {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "")

    const value = controlledValue ?? uncontrolledValue
    const onChange = onValueChange ?? setUncontrolledValue

    return (
        <TabsContext.Provider value={{ value, onChange }}>
            <div className={cn("w-full", className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    )
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> { }

export function TabsList({ className, ...props }: TabsListProps) {
    return (
        <div
            className={cn(
                "inline-flex h-10 items-center justify-start gap-1 rounded-md bg-muted p-1",
                className
            )}
            {...props}
        />
    )
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string
}

export function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
    const { value: selectedValue, onChange } = useTabs()
    const isSelected = selectedValue === value

    return (
        <button
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(value)}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isSelected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                className
            )}
            {...props}
        />
    )
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string
}

export function TabsContent({ value, className, ...props }: TabsContentProps) {
    const { value: selectedValue } = useTabs()

    if (selectedValue !== value) return null

    return (
        <div
            role="tabpanel"
            className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
            {...props}
        />
    )
}
