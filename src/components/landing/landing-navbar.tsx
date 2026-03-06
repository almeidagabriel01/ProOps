"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Layers, Menu, X } from "lucide-react";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import {
  motion,
  AnimatePresence,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import type { User } from "@/types";

interface LandingNavbarProps {
  currentUser: User | null;
  onSignOut: () => void;
}

const navLinks = [
  { href: "#showcase", label: "A Plataforma" },
  { href: "#modulos", label: "Módulos" },
  { href: "#recursos", label: "Funcionalidades" },
  { href: "#pricing", label: "Preços" },
];

export function LandingNavbar({ currentUser, onSignOut }: LandingNavbarProps) {
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastScrollY = useRef(0);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const direction = latest > lastScrollY.current ? "down" : "up";
    lastScrollY.current = latest;

    if (latest > 80 && direction === "down") {
      setHidden(true);
    } else if (direction === "up") {
      setHidden(false);
    }
  });

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Pill container */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{
          y: hidden ? -6 : 0,
          opacity: 1,
        }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 px-4"
      >
        <nav
          id="navbar"
          className="w-full max-w-[1200px] h-14 rounded-full transition-colors duration-400"
          style={{
            background:
              "color-mix(in srgb, var(--background) 70%, transparent)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div className="h-full px-6 flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <motion.div
                whileHover={{ rotate: 12, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="w-[30px] h-[30px] rounded-lg bg-brand-500 flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.25)]"
              >
                <Layers className="text-white w-4 h-4" />
              </motion.div>
              <span className="font-bold text-base tracking-tight text-foreground group-hover:text-brand-400 transition-colors duration-300 hidden sm:inline">
                NexERP
              </span>
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.07, duration: 0.4 }}
                >
                  <Link
                    href={link.href}
                    className="relative px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-300 rounded-full hover:bg-foreground/5 group"
                  >
                    {link.label}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-brand-500 group-hover:w-3/5 transition-all duration-300 rounded-full" />
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Theme Toggle */}
              <AnimatedThemeToggler className="w-[34px] h-[34px] flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all duration-300 [&_svg]:w-[18px] [&_svg]:h-[18px]" />

              {/* Auth Buttons */}
              <div className="hidden sm:flex items-center gap-3">
                {currentUser ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={onSignOut}
                      className="bg-white text-black px-5 py-2 rounded-full text-[12px] font-semibold hover:bg-gray-100 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.06)] hover:shadow-[0_0_25px_rgba(255,255,255,0.12)] hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
                    >
                      Entrar
                    </Link>
                    <Link
                      href="/register"
                      className="group relative inline-flex items-center bg-white text-black px-5 py-2 rounded-full text-[12px] font-semibold hover:bg-gray-100 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.06)] hover:shadow-[0_0_25px_rgba(255,255,255,0.12)] hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                    >
                      <span className="relative z-10">Demonstração</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-400 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <X className="w-4.5 h-4.5" />
                ) : (
                  <Menu className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
          </div>
        </nav>
      </motion.div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-2xl md:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full gap-8">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-2xl font-semibold text-foreground hover:text-brand-400 transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="flex flex-col items-center gap-4 mt-4"
              >
                {currentUser ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="text-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        onSignOut();
                        setMobileOpen(false);
                      }}
                      className="bg-white text-black px-8 py-3 rounded-full text-sm font-semibold"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="text-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Iniciar Sessão
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                      className="bg-white text-black px-8 py-3 rounded-full text-sm font-semibold hover:bg-gray-100 transition-colors"
                    >
                      Agendar Demonstração
                    </Link>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
