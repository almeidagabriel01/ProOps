"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Package,
    Users,
    Settings,
    LogOut,
    Box
} from "lucide-react"

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Package, label: "Produtos", href: "/products/new" }, // Pointing to the new page for demo
    { icon: Users, label: "Clientes", href: "/customers" },
    { icon: Box, label: "Estoque", href: "/inventory" },
    { icon: Settings, label: "Configurações", href: "/settings" },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50">
            <div className="p-6 flex items-center gap-2 border-b border-border h-16">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-lg">E</span>
                </div>
                <span className="text-xl font-bold tracking-tight">ERP PRO</span>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-border">
                <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                    <LogOut className="w-5 h-5" />
                    Sair
                </button>
            </div>
        </aside>
    )
}
