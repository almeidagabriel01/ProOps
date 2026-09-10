import React from "react";
import Image from "next/image";
import Link from "next/link";

import {
  INSTAGRAM_HREF,
  WHATSAPP_HREF,
} from "@/components/landing/_shared/whatsapp";
import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Marquee } from "@/components/marketing/_shared/marquee";
import { SITE_URLS } from "@/lib/site/surfaces";

import { EMPRESA_LINKS } from "./nav-links";

const PRODUTOS = [
  { rotulo: "ProOps ERP", href: SITE_URLS.erp },
  { rotulo: "Aplicativo", href: SITE_URLS.app },
];

/**
 * The legal pages are apex-owned and their canonical already anchors there, so a
 * relative href is correct from any host: only `/` is ever rewritten, which is
 * why `/privacy` answers 200 on all three domains.
 */
const LEGAIS = [
  { rotulo: "Privacidade", href: "/privacy" },
  { rotulo: "Termos de uso", href: "/terms" },
  { rotulo: "Cookies", href: "/cookies" },
  { rotulo: "Exclusão de dados", href: "/data-deletion" },
];

/**
 * Footer of the company site, on every one of its pages.
 *
 * It closes with the wordmark as a band rather than as a line of text. A footer
 * is where a long scroll stops, and the page should land on something instead of
 * trailing off: the band is the last piece of movement, and it is the only loop
 * in the footer, so there is nothing here to keep a GPU awake once it scrolls
 * past (`Marquee` wraps itself in `PauseOffscreen`).
 */
export function EmpresaFooter() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/10 bg-neutral-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-10 md:py-20">
        <div>
          {/* O PNG da marca é 1600x1600; uma caixa não quadrada faria o
              object-contain encolher o símbolo até a altura dela. O SVG branco é
              o que serve sobre o quase-preto desta página. */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo/logo2-cropped.svg"
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              className="shrink-0"
            />
            <span className="[font-family:var(--font-bricolage)] text-[17px] font-bold tracking-tight text-white">
              ProOps
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
            Software de gestão para quem vende projeto, e para a pessoa por trás
            dele.
          </p>
          <a
            href="mailto:gestao@proops.com.br"
            className="mt-6 inline-block [font-family:var(--font-geist-mono)] text-xs uppercase tracking-[0.18em] text-white/55 transition-colors hover:text-white"
          >
            gestao@proops.com.br
          </a>
        </div>

        <nav aria-label="A empresa">
          <h2 className="mb-4 [font-family:var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
            A empresa
          </h2>
          <ul className="space-y-2.5">
            {EMPRESA_LINKS.map((item) => (
              <li key={item.href}>
                <CurtainLink
                  href={item.href}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {item.rotulo}
                </CurtainLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Produtos">
          <h2 className="mb-4 [font-family:var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
            Produtos
          </h2>
          <ul className="space-y-2.5">
            {PRODUTOS.map((item) => (
              <li key={item.rotulo}>
                <a
                  href={item.href}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {item.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className="mb-4 [font-family:var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
            Legal
          </h2>
          <ul className="space-y-2.5">
            {LEGAIS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {item.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Marquee duracao={44} className="border-y border-white/[0.07] py-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className="flex shrink-0 items-center gap-8 pr-8 [font-family:var(--font-bricolage)] text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-none tracking-[-0.04em] text-white/[0.07]"
          >
            ProOps
            <span aria-hidden="true" className="text-white/[0.12]">
              ·
            </span>
          </span>
        ))}
      </Marquee>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:px-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="[font-family:var(--font-geist-mono)] text-xs text-white/35">
          © {new Date().getFullYear()} ProOps. Todos os direitos reservados.
        </p>
        <div className="flex items-center gap-5">
          <a
            href={INSTAGRAM_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/50 transition-colors hover:text-white"
          >
            Instagram
          </a>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/50 transition-colors hover:text-white"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
