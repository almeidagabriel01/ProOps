"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { User } from "@/types";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { ProOpsLogo } from "@/components/branding/proops-logo";

interface LandingNavbarProps {
  currentUser: User | null;
  onSignOut: () => void;
}

function getAuthenticatedHome(user: User): string {
  if (user.role === "superadmin") {
    return "/admin";
  }

  const isAdmin = ["admin", "superadmin", "MASTER"].includes(user.role);
  const permissions = user.permissions || {};

  if (isAdmin || permissions.dashboard?.canView === true) {
    return "/dashboard";
  }

  const orderedPages = [
    "proposals",
    "clients",
    "products",
    "financial",
    "profile",
  ];

  const firstAllowedPage = orderedPages.find(
    (page) => permissions[page]?.canView === true || page === "profile",
  );

  return firstAllowedPage ? `/${firstAllowedPage}` : "/403";
}

const navLinks = [
  { href: "#showcase", label: "Plataforma" },
  { href: "#modulos", label: "Módulos" },
  { href: "#recursos", label: "Recursos" },
  { href: "#pricing", label: "Planos" },
];

export function LandingNavbar({ currentUser, onSignOut }: LandingNavbarProps) {
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastScrollY = useRef(0);
  const navRef = useRef<HTMLElement>(null);
  const appHref = currentUser ? getAuthenticatedHome(currentUser) : "/login";
  const isFreeAccount = currentUser?.role === "free";

  const scrollToAnchor = (href: string, closeMobile = false) => {
    if (!href.startsWith("#")) return;

    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;

    const navHeight = navRef.current?.offsetHeight ?? 64;
    const top =
      target.getBoundingClientRect().top + window.scrollY - (navHeight + 20);

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: "smooth",
    });

    window.history.replaceState(null, "", href);

    if (closeMobile) {
      setMobileOpen(false);
    }
  };

  const handleAnchorClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    closeMobile = false,
  ) => {
    if (!href.startsWith("#")) return;

    event.preventDefault();
    scrollToAnchor(href, closeMobile);
  };

  useEffect(() => {
    const handleScroll = () => {
      const latest = window.scrollY;
      const direction = latest > lastScrollY.current ? "down" : "up";
      lastScrollY.current = latest;

      if (latest > 80 && direction === "down") {
        setHidden(true);
        return;
      }

      if (direction === "up") {
        setHidden(false);
      }
    };

    lastScrollY.current = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: hidden ? -8 : 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
      >
        <nav
          ref={navRef}
          className="h-16 w-full max-w-[1200px] rounded-full border border-black/10 bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/85 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
            <Link
              href="/"
              className="group relative inline-flex shrink-0 items-center gap-3 overflow-hidden rounded-full leading-none"
              aria-label="ProOps"
            >
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full md:h-11 md:w-11">
                <ProOpsLogo
                  variant="symbol"
                  width={116}
                  height={116}
                  priority
                  invertOnDark
                  className="block h-full w-full scale-[2.55] object-contain md:scale-[2.7] group-hover:scale-[2.7] md:group-hover:scale-[2.85]"
                />
              </div>
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.35 }}
                >
                  <Link
                    href={link.href}
                    onClick={(event) => handleAnchorClick(event, link.href)}
                    className="group relative rounded-full px-3.5 py-1.5 text-[13px] font-medium text-black/65 transition-colors duration-200 hover:bg-black/[0.03] hover:text-black dark:text-white/65 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    {link.label}
                    <span className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-black transition-all duration-200 group-hover:w-3/5 dark:bg-white" />
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden items-center gap-3 sm:flex">
                <AnimatedThemeToggler
                  className="inline-flex h-8 w-8 items-center justify-center text-black/75 transition-colors hover:text-black dark:text-white/80 dark:hover:text-white"
                  aria-label="Alternar tema"
                />

                {currentUser ? (
                  <>
                    {isFreeAccount ? (
                      <button
                        type="button"
                        onClick={() => scrollToAnchor("#pricing")}
                        className="text-[13px] cursor-pointer font-medium text-black/65 transition-colors hover:text-black dark:text-white/65 dark:hover:text-white"
                      >
                        Ver planos
                      </button>
                    ) : (
                      <Link
                        href={appHref}
                        className="text-[13px] font-medium text-black/65 transition-colors hover:text-black dark:text-white/65 dark:hover:text-white"
                      >
                        Entrar no ERP
                      </Link>
                    )}

                    <button
                      onClick={onSignOut}
                      className="rounded-full cursor-pointer bg-black px-5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="text-[13px] font-medium text-black/65 transition-colors hover:text-black dark:text-white/65 dark:hover:text-white"
                  >
                    Entrar
                  </Link>
                )}
              </div>

              <AnimatedThemeToggler
                className="inline-flex h-8 w-8 items-center justify-center text-black/75 transition-colors hover:text-black dark:text-white/80 dark:hover:text-white md:hidden"
                aria-label="Alternar tema"
              />

              <button
                onClick={() => setMobileOpen((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.04] hover:text-black dark:text-white/70 dark:hover:bg-white/[0.08] dark:hover:text-white md:hidden"
                aria-label="Abrir menu"
              >
                {mobileOpen ? (
                  <X className="h-[18px] w-[18px]" />
                ) : (
                  <Menu className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>
          </div>
        </nav>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-white/95 backdrop-blur-2xl dark:bg-neutral-950/95 md:hidden"
          >
            <div className="flex h-full flex-col items-center justify-center gap-8">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                >
                  <Link
                    href={link.href}
                    onClick={(event) => handleAnchorClick(event, link.href, true)}
                    className="text-2xl font-semibold text-black transition-colors hover:text-black/70 dark:text-white dark:hover:text-white/70"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="mt-4 flex flex-col items-center gap-4"
              >
                {currentUser ? (
                  <>
                    {isFreeAccount ? (
                      <button
                        type="button"
                        onClick={() => scrollToAnchor("#pricing", true)}
                        className="text-lg text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white"
                      >
                        Ver planos
                      </button>
                    ) : (
                      <Link
                        href={appHref}
                        onClick={() => setMobileOpen(false)}
                        className="text-lg text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white"
                      >
                        Entrar no ERP
                      </Link>
                    )}

                    <button
                      onClick={() => {
                        onSignOut();
                        setMobileOpen(false);
                      }}
                      className="rounded-full bg-black px-8 py-3 text-sm font-semibold text-white dark:bg-white dark:text-black"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="text-lg text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white"
                  >
                    Entrar
                  </Link>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
