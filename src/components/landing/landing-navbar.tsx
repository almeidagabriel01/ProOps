"use client";

import Link from "next/link";
import { Sparkles, Users, ChevronDown, LogOut, ArrowRight } from "lucide-react";
import { MobileMenu } from "@/components/ui/mobile-menu";

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
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/70 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        ERP PRO
                    </span>
                </div>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="px-4 py-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* Buttons / User Menu */}
                <div className="flex items-center gap-3">
                    {currentUser ? (
                        <div className="relative group">
                            <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all duration-200">
                                <div className="flex flex-col items-end hidden sm:flex">
                                    <span className="text-sm font-medium text-white">
                                        {currentUser.name}
                                    </span>
                                    <span className="text-xs text-neutral-400 capitalize">
                                        {currentUser.role === "free"
                                            ? "Conta Gratuita"
                                            : currentUser.role}
                                    </span>
                                </div>
                                <div className="h-9 w-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-violet-400" />
                                </div>
                                <ChevronDown className="w-4 h-4 text-neutral-400 hidden sm:block" />
                            </button>
                            {/* Dropdown */}
                            <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                <div className="p-3 border-b border-neutral-800">
                                    <p className="text-sm font-medium text-white truncate">
                                        {currentUser.name}
                                    </p>
                                    <p className="text-xs text-neutral-400 truncate">
                                        {currentUser.email}
                                    </p>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={onSignOut}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
                                <button className="px-4 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-all duration-200 cursor-pointer">
                                    Entrar
                                </button>
                            </Link>
                            <Link href="/login" className="hidden md:block">
                                <button className="group relative px-5 py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-xl font-medium flex items-center gap-2 transition-all duration-300 cursor-pointer shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105">
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
