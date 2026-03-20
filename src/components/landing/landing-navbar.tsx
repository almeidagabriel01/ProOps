"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { User } from "@/types";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { ProOpsLogo } from "@/components/branding/proops-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const [freePlanModalOpen, setFreePlanModalOpen] = useState(false);
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
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4"
      >
        <nav
          ref={navRef}
          className="w-full max-w-[1200px] h-16 rounded-full border border-black/10 dark:border-white/10 bg-white/90 dark:bg-neutral-950/85 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          <div className="h-full px-4 md:px-6 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="group relative inline-flex shrink-0 items-center gap-3 overflow-hidden rounded-full cursor-pointer leading-none"
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
              <div className="hidden lg:block text-left">
                <p className="text-[13px] font-semibold text-black dark:text-white">
                  ProOps
                </p>
                <p className="text-[11px] text-black/50 dark:text-white/50">
                  Sistema ERP para gestao de servicos
                </p>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1">
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
                    className="relative px-3.5 py-1.5 text-[13px] font-medium text-black/65 dark:text-white/65 hover:text-black dark:hover:text-white transition-colors duration-200 rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.06] group cursor-pointer"
                  >
                    {link.label}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-black dark:bg-white group-hover:w-3/5 transition-all duration-200 rounded-full" />
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-3">
                <AnimatedThemeToggler
                  className="h-8 w-8 inline-flex items-center justify-center text-black/75 dark:text-white/80 hover:text-black dark:hover:text-white transition-colors"
                  aria-label="Alternar tema"
                />
                {currentUser ? (
                  <>
                    {isFreeAccount ? (
                      <button
                        type="button"
                        onClick={() => setFreePlanModalOpen(true)}
                        className="text-[13px] font-medium text-black/65 dark:text-white/65 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                      >
                        Entrar no ERP
                      </button>
                    ) : (
                      <Link
                        href={appHref}
                        className="text-[13px] font-medium text-black/65 dark:text-white/65 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                      >
                        Entrar no ERP
                      </Link>
                    )}
                    <button
                      onClick={onSignOut}
                      className="bg-black dark:bg-white text-white dark:text-black px-5 py-2 rounded-full text-[12px] font-semibold hover:bg-black/85 dark:hover:bg-white/90 transition-colors cursor-pointer"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-[13px] font-medium text-black/65 dark:text-white/65 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Entrar
                    </Link>
                  </>
                )}
              </div>

              <AnimatedThemeToggler
                className="h-8 w-8 md:hidden inline-flex items-center justify-center text-black/75 dark:text-white/80 hover:text-black dark:hover:text-white transition-colors"
                aria-label="Alternar tema"
              />

              <button
                onClick={() => setMobileOpen((prev) => !prev)}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-full text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                aria-label="Abrir menu"
              >
                {mobileOpen ? (
                  <X className="w-[18px] h-[18px]" />
                ) : (
                  <Menu className="w-[18px] h-[18px]" />
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
            className="fixed inset-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-2xl md:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full gap-8">
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
                    onClick={(event) =>
                      handleAnchorClick(event, link.href, true)
                    }
                    className="text-2xl font-semibold text-black dark:text-white hover:text-black/70 dark:hover:text-white/70 transition-colors cursor-pointer"
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
                className="flex flex-col items-center gap-4 mt-4"
              >
                {currentUser ? (
                  <>
                    {isFreeAccount ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false);
                          setFreePlanModalOpen(true);
                        }}
                        className="text-lg text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                      >
                        Entrar no ERP
                      </button>
                    ) : (
                      <Link
                        href={appHref}
                        onClick={() => setMobileOpen(false)}
                        className="text-lg text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                      >
                        Entrar no ERP
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        onSignOut();
                        setMobileOpen(false);
                      }}
                      className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-full text-sm font-semibold cursor-pointer"
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="text-lg text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Entrar
                    </Link>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={freePlanModalOpen} onOpenChange={setFreePlanModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conta Free</DialogTitle>
            <DialogDescription>
              Sua conta ainda está no plano gratuito. Para acessar o ERP, é
              necessário escolher e assinar um plano.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            Você pode comparar os planos abaixo na landing e seguir para a
            assinatura do que fizer sentido para a sua operação.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFreePlanModalOpen(false)}
            >
              Agora não
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFreePlanModalOpen(false);
                scrollToAnchor("#pricing");
              }}
            >
              Ver planos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
