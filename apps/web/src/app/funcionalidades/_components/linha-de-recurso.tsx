import React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";

import {
  escadaDoLimite,
  nichosDoRecurso,
  seloDoPlano,
  type Recurso,
} from "@/lib/landing/funcionalidades";
import { DEFAULT_PLANS } from "@/lib/plans/default-plans";
import { cn } from "@/lib/utils";

import { normalizarBusca } from "./normalizar-busca";

/** Os tiers que já trazem o recurso, para o filtro por plano casar sem JS de cálculo. */
function tiersQueIncluem(aPartirDe: string | null): string {
  if (!aPartirDe) return "";
  const ordem = DEFAULT_PLANS.find((p) => p.tier === aPartirDe)?.order ?? Infinity;
  return DEFAULT_PLANS.filter((p) => p.order >= ordem)
    .map((p) => p.tier)
    .join(" ");
}

function SeloDaLinha({
  rotulo,
  rotuloAddon,
  className,
}: {
  rotulo: string;
  rotuloAddon: string | null;
  className?: string;
}) {
  return (
    <span className={cn("flex shrink-0 flex-wrap gap-x-3 gap-y-1.5", className)}>
      <span className="selo rounded-full border border-black/12 px-2.5 py-1 text-[11.5px] font-semibold leading-none text-black/75 dark:border-white/15 dark:text-white/75">
        {rotulo}
      </span>
      {rotuloAddon ? (
        <span className="selo-addon text-[11px] font-medium leading-none text-black/45 dark:text-white/45">
          {rotuloAddon}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Uma estação do capítulo: o recurso numa linha, aberto num clique.
 *
 * `<details>` nativo, e não um acordeão em React: zero JavaScript, teclado e
 * leitor de tela de graça, e o conteúdo fechado continua no HTML para a busca
 * do navegador e para o rastreador. A abertura anima com
 * `interpolate-size` onde o navegador suporta; onde não suporta, abre seca.
 *
 * Os `data-*` são o contrato com o filtro (`filtro-de-recursos.tsx`): ele
 * esconde linhas lendo `data-texto`, `data-inclui` e `data-addon`, sem
 * renderizar nada de novo.
 */
export function LinhaDeRecurso({ recurso }: { recurso: Recurso }) {
  const selo = seloDoPlano(recurso.requisito);
  const nichos = nichosDoRecurso(recurso.nichos);
  const Icone = recurso.icone;
  const texto = normalizarBusca(
    [recurso.titulo, recurso.resumo, ...recurso.detalhes, recurso.ondeFica ?? "", ...nichos].join(" "),
  );

  return (
    <li
      id={recurso.id}
      data-recurso=""
      data-texto={texto}
      data-inclui={tiersQueIncluem(selo.aPartirDe)}
      data-addon={selo.addonEm.map((a) => a.tier).join(" ")}
      className="recurso-linha vt-revela relative scroll-mt-28"
    >
      <details className="recurso-detalhes group/recurso">
        <summary className="relative flex cursor-pointer list-none items-start gap-4 rounded-xl py-5 pl-11 pr-3 outline-none transition-colors duration-200 hover:bg-black/[0.025] focus-visible:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/[0.035] dark:focus-visible:ring-white/40 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="absolute left-[8.5px] top-[27px] z-10 h-[13px] w-[13px] rounded-full border-[2.5px] border-black bg-white transition-colors duration-200 group-open/recurso:bg-black dark:border-white dark:bg-neutral-950 dark:group-open/recurso:bg-white"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Icone className="h-4 w-4 shrink-0 text-black/45 dark:text-white/45" aria-hidden />
              <h3 className="text-[17px] font-semibold leading-snug text-black dark:text-white">
                {recurso.titulo}
              </h3>
            </div>
            <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-black/60 dark:text-white/60">
              {recurso.resumo}
            </p>
            {/* No celular o selo vem embaixo: ao lado, ele espremia o texto numa coluna de 150px. */}
            <SeloDaLinha rotulo={selo.rotulo} rotuloAddon={selo.rotuloAddon} className="mt-3 flex-row items-center sm:hidden" />
          </div>
          <SeloDaLinha rotulo={selo.rotulo} rotuloAddon={selo.rotuloAddon} className="hidden flex-col items-end pt-0.5 sm:flex" />
          <ChevronDown
            aria-hidden
            className="mt-1 hidden h-4 w-4 shrink-0 text-black/35 transition-transform duration-300 group-open/recurso:rotate-180 dark:text-white/35 sm:block"
          />
        </summary>

        <div className="recurso-corpo pb-6 pl-11 pr-3">
          <ul className="max-w-2xl space-y-2">
            {recurso.detalhes.map((detalhe) => (
              <li
                key={detalhe}
                className="relative pl-4 text-[15px] leading-relaxed text-black/70 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2 before:bg-black/40 dark:text-white/70 dark:before:bg-white/40"
              >
                {detalhe}
              </li>
            ))}
          </ul>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
            {recurso.ondeFica ? (
              <div className="flex gap-1.5">
                <dt className="text-black/45 dark:text-white/45">No ERP</dt>
                <dd className="font-medium text-black/75 dark:text-white/75">{recurso.ondeFica}</dd>
              </div>
            ) : null}
            {recurso.limite ? (
              <div className="flex gap-1.5">
                <dt className="text-black/45 dark:text-white/45">Limite</dt>
                <dd className="font-medium text-black/75 dark:text-white/75">
                  {escadaDoLimite(recurso.limite.chave, recurso.limite.unidade)}
                </dd>
              </div>
            ) : null}
            {nichos.length ? (
              <div className="flex gap-1.5">
                <dt className="text-black/45 dark:text-white/45">Nos segmentos</dt>
                <dd className="font-medium text-black/75 dark:text-white/75">{nichos.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
          {recurso.exemplo ? (
            <Link
              href={recurso.exemplo.href}
              rel="nofollow"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-black underline decoration-black/25 underline-offset-4 transition-colors hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
            >
              {recurso.exemplo.rotulo}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </details>
    </li>
  );
}
