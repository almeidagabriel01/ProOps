"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { ProOpsLogo } from "@/components/branding/proops-logo";
import { getAuthenticatedHome } from "@/lib/landing/auth-redirect";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useHeaderPresentation } from "@/hooks/useHeaderPresentation";
import { getUserColor, getInitials } from "@/lib/avatar-utils";
import { LandingButton } from "./_shared/landing-button";

interface LandingNavbarProps {
  currentUser: User | null;
  onSignOut: () => void;
  isAuthLoading?: boolean;
}

const navLinks = [
  { href: "#showcase", label: "Plataforma" },
  { href: "#modulos", label: "Módulos" },
  { href: "#recursos", label: "Recursos" },
  { href: "#pricing", label: "Planos" },
];

const PILL_CLASSES =
  "rounded-full border border-black/10 bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/85 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]";

export function LandingNavbar({ currentUser, onSignOut, isAuthLoading = false }: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftGroupRef = useRef<HTMLDivElement>(null);
  const rightGroupRef = useRef<HTMLDivElement>(null);
  const [spread, setSpread] = useState({ left: 280, right: 280 });
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { companyName, logoUrl, avatarSeed, isTenantLoading, isCompanyLoading } =
    useHeaderPresentation();
  const isNavbarLoading =
    isAuthLoading || (!!currentUser && (isTenantLoading || isCompanyLoading));
  const appHref = currentUser ? getAuthenticatedHome(currentUser) : "/login";
  const isFreeAccount = currentUser?.role === "free";
  const isBlockedAccount = ["canceled", "cancelled", "unpaid", "inactive", "payment_failed"].includes(
    currentUser?.subscriptionStatus ?? "",
  );
  const showSubscribeCta = !currentUser || isFreeAccount || isBlockedAccount;
  const isLoggedIn = !!currentUser;

  const { scrollY } = useScroll();
  const rawProgress = useTransform(scrollY, [0, 150], [0, 1]);
  const springProgress = useSpring(rawProgress, { stiffness: 260, damping: 30 });
  const progress = prefersReducedMotion ? rawProgress : springProgress;
  const navOpacity = useTransform(progress, [0, 1], [0, 1]);
  const navScale = useTransform(progress, [0, 1], [0.97, 1]);
  const navPointerEvents = useTransform(progress, (v) => (v < 0.4 ? "none" : "auto"));
  const leftX = useTransform(progress, [0, 1], [-spread.left, 0]);
  const rightX = useTransform(progress, [0, 1], [spread.right, 0]);

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

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      // offsetLeft/offsetWidth ignoram transforms — mede a posição natural (centrada)
      const leftEl = leftGroupRef.current;
      const rightEl = rightGroupRef.current;
      const left = leftEl ? Math.max(leftEl.offsetLeft, 0) : 0;
      const right = rightEl
        ? Math.max(container.clientWidth - (rightEl.offsetLeft + rightEl.offsetWidth), 0)
        : 0;
      setSpread({ left, right });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (leftGroupRef.current) observer.observe(leftGroupRef.current);
    if (rightGroupRef.current) observer.observe(rightGroupRef.current);
    return () => observer.disconnect();
  }, [isNavbarLoading, isLoggedIn, showSubscribeCta]);

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
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
      >
        <div
          ref={containerRef}
          className="relative flex h-12 w-full max-w-[1216px] items-center justify-between gap-3 md:justify-center"
        >
          {/* Logo pill — esquerda */}
          <motion.div
            ref={leftGroupRef}
            style={{ x: leftX }}
            className={`flex h-11 shrink-0 items-center overflow-hidden px-3 will-change-transform ${PILL_CLASSES}`}
          >
            <Link
              href="/"
              className="group relative inline-flex shrink-0 items-center leading-none"
              aria-label="ProOps"
            >
              <ProOpsLogo
                variant="full"
                width={220}
                height={76}
                priority
                invertOnDark
                interactive={false}
                className="block h-[74px] w-auto object-contain transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </Link>
          </motion.div>

          {/* Nav pill — centro (somente desktop) */}
          <motion.nav
            ref={navRef}
            style={{
              opacity: navOpacity,
              scale: navScale,
              pointerEvents: navPointerEvents,
              transformOrigin: "center",
            }}
            className={`hidden h-11 items-center gap-1 px-2.5 will-change-[transform,opacity] md:flex ${PILL_CLASSES}`}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(event) => handleAnchorClick(event, link.href)}
                className="group relative rounded-full px-3.5 py-1.5 text-[13px] font-medium text-black/65 transition-colors duration-200 hover:bg-black/[0.03] hover:text-black dark:text-white/65 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                {link.label}
                <span className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-black transition-all duration-200 group-hover:w-3/5 dark:bg-white" />
              </Link>
            ))}
          </motion.nav>

          {/* Grupo direito: [Auth pill] [Quero assinar] [Theme toggle] [Mobile menu] */}
          <motion.div
            ref={rightGroupRef}
            style={{ x: rightX }}
            className="flex shrink-0 items-center gap-2.5 will-change-transform"
          >
            {/* Auth pill — desktop sm+ */}
            <div className={`hidden h-11 items-center px-4 sm:flex ${PILL_CLASSES}`}>
              {isNavbarLoading ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
              ) : currentUser ? (
                // wrapper com [&>div]:mt-0 neutraliza o `mt-1` hardcoded no
                // wrapper interno do DropdownMenu (components/ui), que empurrava
                // o conteúdo 4px para baixo e descentralizava a pill na vertical
                <div className="flex items-center [&>div]:mt-0">
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-2 rounded-full text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white"
                    >
                      <Avatar className="h-7 w-7 border border-black/10 dark:border-white/10">
                        {logoUrl ? (
                          <AvatarImage
                            src={logoUrl}
                            alt={companyName}
                            className="object-cover"
                          />
                        ) : (
                          <AvatarFallback
                            className="text-[10px] font-medium text-white"
                            style={{ backgroundColor: getUserColor(avatarSeed) }}
                          >
                            {getInitials(avatarSeed)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="max-w-[120px] truncate text-[13px] font-medium">
                        {companyName}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className="mt-2 w-52 rounded-2xl border border-black/10 bg-white/90 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.1)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/90 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                  >
                    {/* Header: avatar + company name */}
                    <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
                      <Avatar className="h-8 w-8 shrink-0 border border-black/10 dark:border-white/10">
                        {logoUrl ? (
                          <AvatarImage src={logoUrl} alt={companyName} className="object-cover" />
                        ) : (
                          <AvatarFallback
                            className="text-[10px] font-medium text-white"
                            style={{ backgroundColor: getUserColor(avatarSeed) }}
                          >
                            {getInitials(avatarSeed)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="truncate text-[13px] font-semibold text-black dark:text-white">
                        {companyName}
                      </span>
                    </div>
                    <DropdownMenuSeparator className="mx-1 bg-black/8 dark:bg-white/10" />
                    {isBlockedAccount ? (
                      <DropdownMenuItem
                        onClick={() => scrollToAnchor("#pricing")}
                        className="mt-1 cursor-pointer gap-2 rounded-xl text-[13px] text-black/70 focus:bg-black/[0.04] focus:text-black dark:text-white/70 dark:focus:bg-white/[0.06] dark:focus:text-white"
                      >
                        <Sparkles className="h-4 w-4" />
                        Ver planos
                      </DropdownMenuItem>
                    ) : isFreeAccount ? (
                      <>
                        <DropdownMenuItem
                          onClick={() => scrollToAnchor("#pricing")}
                          className="mt-1 cursor-pointer gap-2 rounded-xl text-[13px] text-black/70 focus:bg-black/[0.04] focus:text-black dark:text-white/70 dark:focus:bg-white/[0.06] dark:focus:text-white"
                        >
                          <Sparkles className="h-4 w-4" />
                          Ver planos
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push("/profile")}
                          className="cursor-pointer gap-2 rounded-xl text-[13px] text-black/70 focus:bg-black/[0.04] focus:text-black dark:text-white/70 dark:focus:bg-white/[0.06] dark:focus:text-white"
                        >
                          <UserIcon className="h-4 w-4" />
                          Meu Perfil
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem
                          onClick={() => router.push(appHref)}
                          className="mt-1 cursor-pointer gap-2 rounded-xl text-[13px] text-black/70 focus:bg-black/[0.04] focus:text-black dark:text-white/70 dark:focus:bg-white/[0.06] dark:focus:text-white"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Entrar no ERP
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push("/profile")}
                          className="cursor-pointer gap-2 rounded-xl text-[13px] text-black/70 focus:bg-black/[0.04] focus:text-black dark:text-white/70 dark:focus:bg-white/[0.06] dark:focus:text-white"
                        >
                          <UserIcon className="h-4 w-4" />
                          Meu Perfil
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="mx-1 bg-black/8 dark:bg-white/10" />
                    <DropdownMenuItem
                      onClick={onSignOut}
                      className="cursor-pointer gap-2 rounded-xl text-[13px] text-red-500 focus:bg-red-50 focus:text-red-600 dark:text-red-400 dark:focus:bg-red-950/30 dark:focus:text-red-400"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <LandingButton
                  href="/login"
                  variant="link"
                  tone="muted"
                  icon={<UserIcon className="h-4 w-4" />}
                  className="text-[13px]"
                >
                  Entrar
                </LandingButton>
              )}
            </div>

            {/* CTA pill — Quero assinar */}
            {showSubscribeCta && !isNavbarLoading && (
              <LandingButton
                variant="solid"
                size="sm"
                onClick={() => scrollToAnchor("#pricing")}
                icon={<Plus className="h-4 w-4" />}
                className="hidden sm:inline-flex"
              >
                Quero assinar
              </LandingButton>
            )}

            {/* Theme toggle pill */}
            <div
              className={`flex h-11 w-11 items-center justify-center ${PILL_CLASSES} max-sm:h-10 max-sm:w-10`}
            >
              <AnimatedThemeToggler
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center text-black/75 transition-colors hover:text-black dark:text-white/80 dark:hover:text-white"
                aria-label="Alternar tema"
              />
            </div>

            {/* Mobile menu button pill */}
            <button
              onClick={() => setMobileOpen((prev) => !prev)}
              className={`flex h-10 w-10 items-center justify-center text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white md:hidden ${PILL_CLASSES}`}
              aria-label="Abrir menu"
            >
              {mobileOpen ? (
                <X className="h-[18px] w-[18px]" />
              ) : (
                <Menu className="h-[18px] w-[18px]" />
              )}
            </button>
          </motion.div>
        </div>
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
                {isNavbarLoading ? (
                  <>
                    <Skeleton className="h-5 w-32 rounded-full" />
                    <Skeleton className="h-10 w-36 rounded-full" />
                  </>
                ) : currentUser ? (
                  <>
                    <span className="text-sm text-black/50 dark:text-white/50 truncate max-w-[200px]">
                      {companyName}
                    </span>
                    {isBlockedAccount ? (
                      <LandingButton
                        variant="link"
                        tone="muted"
                        onClick={() => scrollToAnchor("#pricing", true)}
                        className="text-lg"
                      >
                        Ver planos
                      </LandingButton>
                    ) : isFreeAccount ? (
                      <>
                        <button
                          type="button"
                          onClick={() => scrollToAnchor("#pricing", true)}
                          className="text-lg text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white"
                        >
                          Ver planos
                        </button>
                        <LandingButton
                          href="/profile"
                          variant="link"
                          tone="muted"
                          onClick={() => setMobileOpen(false)}
                          className="text-lg"
                        >
                          Meu Perfil
                        </LandingButton>
                      </>
                    ) : (
                      <LandingButton
                        href={appHref}
                        variant="link"
                        tone="muted"
                        onClick={() => setMobileOpen(false)}
                        className="text-lg"
                      >
                        Entrar no ERP
                      </LandingButton>
                    )}

                    <LandingButton
                      variant="link"
                      tone="muted"
                      className="text-lg"
                      onClick={() => {
                        onSignOut();
                        setMobileOpen(false);
                      }}
                    >
                      Sair
                    </LandingButton>
                  </>
                ) : (
                  <>
                    <LandingButton
                      href="/login"
                      variant="link"
                      tone="muted"
                      onClick={() => setMobileOpen(false)}
                      className="text-lg"
                    >
                      Entrar
                    </LandingButton>
                    <LandingButton
                      variant="solid"
                      size="md"
                      onClick={() => scrollToAnchor("#pricing", true)}
                      icon={<Plus className="h-4 w-4" />}
                    >
                      Quero assinar
                    </LandingButton>
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
