"use client";

import { ReactNode, useEffect, useState } from "react";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import Image from "next/image";

interface AuthLayoutProps {
  children: ReactNode;
  reverse?: boolean;
}

export function AuthLayout({ children, reverse = false }: AuthLayoutProps) {
  const [enableTransitions, setEnableTransitions] = useState(false);

  useEffect(() => {
    // After the initial render & paint, we enable transitions.
    const transitionTimer = setTimeout(() => {
      setEnableTransitions(true);
    }, 50);

    return () => {
      clearTimeout(transitionTimer);
    };
  }, []);

  const reversed = reverse;

  return (
    <>
      <style>{`
        /* 
          Force hardware acceleration and explicit 50vw sizing.
          This prevents the browser from doing layout recalculations (which cause vertical text jitter)
          during the horizontal translate animation.
        */
        @media (min-width: 1024px) {
          .auth-panel-branding,
          .auth-panel-form {
            width: 50vw;
            will-change: transform;
            backface-visibility: hidden;
            -webkit-font-smoothing: antialiased;
          }

          .auth-container[data-mounted="true"] .auth-panel-branding,
          .auth-container[data-mounted="true"] .auth-panel-form {
            transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .auth-container[data-reversed="true"] .auth-panel-branding {
            transform: translate3d(100%, 0, 0);
          }

          .auth-container[data-reversed="true"] .auth-panel-form {
            transform: translate3d(-100%, 0, 0);
          }

          .auth-container[data-reversed="false"] .auth-panel-branding,
          .auth-container[data-reversed="false"] .auth-panel-form {
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>

      <div className="h-screen w-full overflow-hidden relative bg-background">
        {/* Theme Toggle */}
        <div className="absolute top-5 right-5 z-[60]">
          <AnimatedThemeToggler className="p-3 rounded-full bg-card/60 backdrop-blur-xl hover:bg-muted border border-border/40 shadow-xl transition-all duration-300 text-foreground" />
        </div>

        {/* === Container that drives the CSS animation via data-reversed === */}
        <div
          className="auth-container flex h-full w-full"
          data-reversed={reversed ? "true" : "false"}
          data-mounted={enableTransitions ? "true" : "false"}
        >
          {/* ═══════════════════════════════════════════
              BRANDING PANEL - SLIDES
              ═══════════════════════════════════════════ */}
          <div
            className="auth-panel-branding hidden lg:block flex-shrink-0 h-full bg-zinc-100 dark:bg-zinc-950 relative overflow-hidden z-30 transition-colors duration-300"
            style={{ boxShadow: "0 0 80px rgba(0,0,0,0.25)" }}
          >
            {/* ── Background glow effects ── */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] rounded-full bg-primary/20 dark:bg-primary/25 blur-[140px]" />
              <div className="absolute bottom-[-15%] right-[-15%] w-[55%] h-[55%] rounded-full bg-blue-400/10 dark:bg-blue-500/15 blur-[140px]" />
              <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] rounded-full bg-violet-400/10 dark:bg-violet-500/10 blur-[100px]" />
            </div>

            {/* ── Grain noise overlay ── */}
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.08] z-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]" />

            {/* ── Top: Logo + Name (Absolute Positioned) ── */}
            <div className="absolute top-10 left-10 flex items-center gap-4 z-20">
              <div className="w-14 h-14 flex items-center justify-center">
                <Image
                  src="/logo/logo2-cropped.svg"
                  alt="Proops"
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain invert dark:invert-0 transition-[filter] duration-300"
                  priority
                />
              </div>
              <span
                className="text-4xl tracking-tight text-zinc-900 dark:text-white transition-colors duration-300"
                style={{
                  fontFamily:
                    "var(--font-pdf-montserrat), system-ui, sans-serif",
                }}
              >
                <span className="font-normal">Pro</span>
                <span className="font-bold">Ops</span>
              </span>
            </div>

            {/* ── Center: Headline (Absolutely Centered to avoid Flex Layout Shifts) ── */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl px-10 xl:px-16 z-20">
              <div className="text-center">
                <p className="text-primary/80 font-semibold text-sm tracking-[0.2em] uppercase mb-5">
                  Plataforma de gestão
                </p>
                <h1
                  className="text-[2.25rem] xl:text-[3rem] font-extrabold text-zinc-900 dark:text-white leading-[1.1] tracking-tight transition-colors duration-300"
                  style={{
                    fontFamily:
                      "var(--font-pdf-montserrat), system-ui, sans-serif",
                  }}
                >
                  Gestão inteligente{" "}
                  <span className="bg-gradient-to-r from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    para o seu negócio.
                  </span>
                </h1>
                <p className="mt-7 text-[1.05rem] text-zinc-500 dark:text-zinc-400 leading-relaxed transition-colors duration-300">
                  As ferramentas essenciais para você focar no que realmente
                  importa: o crescimento e o sucesso da sua empresa.
                </p>
              </div>
            </div>

            {/* ── Bottom: Footer (Absolute Positioned) ── */}
            <div className="absolute bottom-10 left-10 flex items-center gap-5 text-xs text-zinc-400 dark:text-zinc-600 transition-colors duration-300 z-20">
              <span>&copy; {new Date().getFullYear()} Proops</span>
              <span className="text-zinc-300 dark:text-zinc-800">·</span>
              <a
                href="#"
                className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
              >
                Termos
              </a>
              <span className="text-zinc-300 dark:text-zinc-800">·</span>
              <a
                href="#"
                className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
              >
                Privacidade
              </a>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              FORM PANEL - SLIDES
              ═══════════════════════════════════════════ */}
          <div className="auth-panel-form w-full lg:flex-shrink-0 h-full overflow-y-auto bg-background z-20 transition-colors duration-300">
            <div className="min-h-full w-full flex items-center justify-center p-4 sm:p-6 xl:p-8">
              <div className="w-full max-w-md">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
