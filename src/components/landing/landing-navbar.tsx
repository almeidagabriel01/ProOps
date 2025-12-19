"use client";

import Link from "next/link";
import { Sparkles, Users, ChevronDown, LogOut, ArrowRight, Moon, Sun } from "lucide-react";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { useTheme } from "next-themes";

interface LandingNavbarProps {
    currentUser: any;
    onSignOut: () => void;
}

const navLinks = [
    { label: "Recursos", href: "#features" },
    { label: "Planos", href: "#pricing" },
    { label: "Contato", href: "#contact" },
];

export function LandingNavbar({ currentUser, onSignOut }: LandingNavbarProps) {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/50">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="text-xl font-bold text-foreground">
                        ERP PRO
                    </span>
                </div>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all duration-200 cursor-pointer"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* Buttons / User Menu */}
                <div className="flex items-center gap-3">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer"
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>

                    {currentUser ? (
                        <div className="relative group">
                            <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-all duration-200 cursor-pointer">
                                <div className="flex flex-col items-end hidden sm:flex">
                                    <span className="text-sm font-medium text-foreground">
                                        {currentUser.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground capitalize">
                                        {currentUser.role === "free"
                                            ? "Conta Gratuita"
                                            : currentUser.role}
                                    </span>
                                </div>
                                <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-primary" />
                                </div>
                                <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
                            </button>
                            {/* Dropdown */}
                            <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                <div className="p-3 border-b border-border">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {currentUser.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {currentUser.email}
                                    </p>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={onSignOut}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Sair
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Link href="/login" className="hidden md:block">
                                <button className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg font-medium transition-all duration-200 cursor-pointer">
                                    Entrar
                                </button>
                            </Link>
                            <Link href="/login" className="hidden md:block">
                                <button className="group relative px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground rounded-xl font-medium flex items-center gap-2 transition-all duration-300 cursor-pointer shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105">
                                    <span>Começar Agora</span>
                                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                </button>
                            </Link>
                        </>
                    )}
                    {/* Mobile Menu */}
                    <MobileMenu links={navLinks} />
                </div>
            </div>
        </header>
    );
}

