"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { SITE_URLS } from "@/lib/site/surfaces";
import { cn } from "@/lib/utils";

import { EMPRESA_LINKS } from "./nav-links";

/**
 * Chrome for the company site, on every one of its pages.
 *
 * Not the ERP's `LandingNavbar`: that one is built out of anchors into the ERP
 * home (`#showcase`, `#pricing`) and drives them through the landing's own Lenis
 * instance, so reusing it here would ship links that scroll to nothing.
 *
 * **No "Entrar" here, deliberately.** This is the company: who ProOps is and
 * what it builds. Nothing on it is behind a login, so a sign-in button would be
 * a destination competing with the ones that matter, and it would hand a visitor
 * who has never heard of the ERP a login form for a product they have not been
 * shown. Whoever already has an account arrives at the ERP directly, and the
 * sign-in lives on the ERP's own navbar, which owns the session.
 *
 * It starts transparent over the hero and condenses into a bar once the reader
 * leaves it. The listener is passive and only flips a boolean, so it does not
 * re-render on every frame of the scroll.
 */
export function EmpresaNavbar() {
  const pathname = usePathname();
  const [condensada, setCondensada] = useState(false);
  // The sheet remembers WHICH page it was opened on, not merely that it is open.
  // Comparing that to the current path closes it on navigation for free: an
  // effect watching `pathname` to call `setAberta(false)` is a setState inside an
  // effect, which cascades a render, and the derived form cannot get out of sync.
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const aberta = abertaEm === pathname;
  const ultimo = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      const passou = window.scrollY > 40;
      if (passou !== ultimo.current) {
        ultimo.current = passou;
        setCondensada(passou);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[80] transition-[background-color,backdrop-filter,border-color] duration-500",
        condensada || aberta
          ? "border-b border-white/10 bg-neutral-950/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-10 md:py-6"
      >
        <CurtainLink
          href="/"
          aria-label="ProOps, página inicial"
          className="flex shrink-0 items-center gap-2.5"
        >
          {/*
            The symbol as the white SVG, with the wordmark set live in Bricolage
            rather than baked into a bitmap. ProOpsLogo is not used here: its PNG
            is a 1600x1600 square whose artwork is a horizontal lockup floating
            in transparency, so object-contain shrinks the mark to the height of
            whatever box it is given.
          */}
          <Image
            src="/logo/logo2-cropped.svg"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="shrink-0"
          />
          <span className="[font-family:var(--font-bricolage)] text-[18px] font-bold tracking-tight text-white">
            ProOps
          </span>
        </CurtainLink>

        <div className="hidden items-center gap-8 md:flex">
          {EMPRESA_LINKS.map((link) => {
            const ativo = pathname === link.href;
            return (
              <Magnetic key={link.href} forca={8}>
                <CurtainLink
                  href={link.href}
                  className={cn(
                    "group relative block py-1 text-sm transition-colors duration-300",
                    ativo ? "text-white" : "text-white/60 hover:text-white",
                  )}
                >
                  {link.rotulo}
                  {/*
                    scaleX from the left on hover, and pinned open on the current
                    page. `origin-left` + transform rather than a width so the
                    underline never participates in layout.
                  */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 -bottom-0.5 h-px origin-left bg-white transition-transform duration-300 ease-out",
                      ativo ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                  />
                </CurtainLink>
              </Magnetic>
            );
          })}

          <span aria-hidden="true" className="h-4 w-px bg-white/15" />

          <a
            href={SITE_URLS.erp}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 transition-colors duration-300 hover:text-white"
          >
            ERP
          </a>
          <a
            href={SITE_URLS.app}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 transition-colors duration-300 hover:text-white"
          >
            Aplicativo
          </a>
        </div>

        <button
          type="button"
          onClick={() => setAbertaEm(aberta ? null : pathname)}
          aria-expanded={aberta}
          aria-controls="menu-empresa"
          aria-label={aberta ? "Fechar menu" : "Abrir menu"}
          className="relative z-10 flex h-9 w-9 flex-col items-center justify-center gap-[5px] md:hidden"
        >
          <span
            aria-hidden="true"
            className={cn(
              "block h-px w-5 bg-white transition-transform duration-300",
              aberta && "translate-y-[3px] rotate-45",
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              "block h-px w-5 bg-white transition-transform duration-300",
              aberta && "-translate-y-[3px] -rotate-45",
            )}
          />
        </button>
      </nav>

      {/*
        The sheet is always in the DOM and collapsed by max-height, so opening it
        is one compositor-friendly transition instead of a mount. `invisible`
        when closed keeps its links out of the tab order and out of the
        accessibility tree, which a max-height of 0 alone does not do.
      */}
      <div
        id="menu-empresa"
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-500 ease-out md:hidden",
          aberta ? "max-h-[70svh] opacity-100" : "invisible max-h-0 opacity-0",
        )}
      >
        <div className="flex flex-col gap-1 px-6 pb-8 pt-2">
          {EMPRESA_LINKS.map((link) => (
            <CurtainLink
              key={link.href}
              href={link.href}
              className="border-b border-white/[0.07] py-4 [font-family:var(--font-bricolage)] text-2xl font-semibold text-white"
            >
              {link.rotulo}
              <span className="mt-1 block text-sm font-normal text-white/45 [font-family:inherit]">
                {link.resumo}
              </span>
            </CurtainLink>
          ))}
          <div className="mt-5 flex gap-6">
            <a
              href={SITE_URLS.erp}
              target="_blank"
              rel="noopener noreferrer"
              className="[font-family:var(--font-geist-mono)] text-xs uppercase tracking-[0.2em] text-white/55"
            >
              ERP
            </a>
            <a
              href={SITE_URLS.app}
              target="_blank"
              rel="noopener noreferrer"
              className="[font-family:var(--font-geist-mono)] text-xs uppercase tracking-[0.2em] text-white/55"
            >
              Aplicativo
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
