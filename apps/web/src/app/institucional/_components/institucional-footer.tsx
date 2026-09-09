import Image from "next/image";
import Link from "next/link";

import {
  INSTAGRAM_HREF,
  WHATSAPP_HREF,
} from "@/components/landing/_shared/whatsapp";
import { SITE_URLS } from "@/lib/site/surfaces";

const PRODUTOS = [
  { label: "ProOps ERP", href: SITE_URLS.erp, external: true },
  { label: "Aplicativo", href: SITE_URLS.app, external: true },
];

// These pages live on whichever host serves them today and are unchanged by
// this work. Where they end up canonically is a cutover decision, not a Phase 3
// one, so they stay relative until then.
const INSTITUCIONAL = [
  { label: "Privacidade", href: "/privacy" },
  { label: "Termos de uso", href: "/terms" },
  { label: "Cookies", href: "/cookies" },
  { label: "Exclusão de dados", href: "/data-deletion" },
];

export function InstitucionalFooter() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950 px-6 py-14 text-white md:px-10">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          {/* O PNG e 1600x1600; uma caixa nao quadrada faria o object-contain
            encolher a marca ate a altura dela. E o arquivo e escuro, entao
            sobre o quase-preto desta pagina ele e sempre invertido. */}
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
        </div>

        <nav aria-label="Produtos">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
            Produtos
          </h2>
          <ul className="space-y-2.5">
            {PRODUTOS.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Institucional">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
            Institucional
          </h2>
          <ul className="space-y-2.5">
            {INSTITUCIONAL.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="mailto:gestao@proops.com.br"
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                Falar com a gente
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-white/40">
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
