"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";

interface LandingNavbarProps {
  currentUser: any;
  onSignOut: () => void;
}

export function LandingNavbar({ currentUser, onSignOut }: LandingNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${
        isScrolled
          ? "bg-black/80 backdrop-blur-md border-white/10"
          : "border-transparent bg-transparent"
      }`}
      id="navbar"
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Layers className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">
            NexERP
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <Link href="#showcase" className="hover:text-white transition-colors">
            A Plataforma
          </Link>
          <Link href="#modulos" className="hover:text-white transition-colors">
            Módulos
          </Link>
          <Link href="#recursos" className="hover:text-white transition-colors">
            Funcionalidades
          </Link>
          <Link href="#pricing" className="hover:text-white transition-colors">
            Preços
          </Link>
        </div>

        {/* CTA Area */}
        <div className="flex items-center gap-4">
          {currentUser ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block"
              >
                Dashboard
              </Link>
              <button
                onClick={onSignOut}
                className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors hidden sm:block"
              >
                Iniciar Sessão
              </Link>
              <Link
                href="/register"
                className="inline-block bg-white text-black px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Agendar Demonstração
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
