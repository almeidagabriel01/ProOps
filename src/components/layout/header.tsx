"use client"

import { Bell, Search, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function Header() {
    return (
        <header className="fixed top-0 right-0 left-64 h-16 bg-background/80 backdrop-blur-md border-b border-border z-40 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4 w-96">
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar..."
                        className="pl-9 h-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground rounded-full">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
                </Button>
                <div className="h-8 w-[1px] bg-border mx-2" />
                <div className="flex items-center gap-3 pl-2">
                    <div className="flex flex-col items-end hidden md:flex">
                        <span className="text-sm font-medium">Sof T. Code</span>
                        <span className="text-xs text-muted-foreground">Admin</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden">
                        <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                </div>
            </div>
        </header>
    )
}
