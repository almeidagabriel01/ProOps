import React from "react";

import { LiquidGlass } from "@/components/marketing/_shared/liquid-glass";
import { PauseOffscreen } from "@/components/marketing/_shared/pause-offscreen";

interface Plano {
  nome: string;
  mensal: string;
  anual: string;
  para: string;
  inclui: string[];
  destaque?: boolean;
}

/**
 * Prices as the app itself defines them, in `src/lib/billing.ts`.
 *
 * The permanent free tier is NOT advertised. It exists in the app today, and
 * the product decision to replace it with the seven-day trial is already
 * recorded in the app's own handoff notes. Putting it on a page that goes live
 * around launch would be promising something scheduled for removal, which is
 * the one promise a pricing section must never make.
 */
const PLANOS: Plano[] = [
  {
    nome: "Pro",
    mensal: "R$ 24,90",
    anual: "R$ 249,00 por ano",
    para: "Para você, e mais duas pessoas",
    inclui: [
      "3 pessoas no mesmo financeiro",
      "1.000 mensagens de IA por mês",
      "Importação de extrato OFX e CSV",
    ],
    destaque: true,
  },
  {
    nome: "Família",
    mensal: "R$ 39,90",
    anual: "R$ 399,00 por ano",
    para: "Para a casa inteira",
    inclui: [
      "5 pessoas no mesmo financeiro",
      "2.000 mensagens de IA por mês",
      "Autoria por lançamento",
    ],
  },
];

/**
 * Prices, with nothing to click. The last section of the page.
 *
 * Informative on purpose, and it will stay that way. The app charges through
 * in-app purchase, so the transaction happens inside the store and there is no
 * web checkout to link to. A buy button here would also drag the page into App
 * Review's scope, which an informative page stays out of.
 *
 * ─── QUANDO O APP ESTIVER PUBLICADO ──────────────────────────────────────────
 *
 * O bloco `#lojas` no fim desta seção é o lugar reservado para isso, e o que
 * entra ali é:
 *
 *  1. Dois botões de loja, App Store e Google Play, com os selos oficiais de
 *     cada uma. Os selos têm regras próprias de proporção, área livre e
 *     tradução, e usar um recorte de captura é a forma clássica de a submissão
 *     voltar. Baixe os oficiais: Apple em developer.apple.com/app-store/
 *     marketing/guidelines e Google em play.google.com/intl/pt-BR/badges.
 *
 *  2. Um QR code apontando para a página do app, ao lado dos botões. Ele é
 *     para QUEM ESTÁ NO DESKTOP: quem já está no celular toca o botão, e
 *     mostrar QR para essa pessoa é pedir que ela fotografe a própria tela.
 *     Vale, portanto, esconder o QR abaixo de `md` e esconder os botões
 *     acima dele, ou manter os dois com o QR discreto.
 *
 *  3. O QR deve apontar para UM link que decide a loja pelo sistema do
 *     aparelho, não para uma das duas: um QR por loja obriga a pessoa a saber
 *     qual é a dela antes de apontar a câmera. Um link único também dá
 *     rastreamento de origem numa medição só.
 *
 * Gere o QR em build ou em SVG estático, não por script de terceiro em
 * runtime: a CSP desta aplicação não permite script externo fora do allowlist,
 * e um QR que depende de CDN é um QR que um dia não carrega.
 *
 * Nada disso é possível hoje: o app não está em nenhuma das duas lojas, e não
 * há conta de desenvolvedor aberta em nenhuma das duas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function AplicativoPlanos() {
  return (
    <section
      id="planos"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />
          Planos
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          Sete dias para testar. Depois você decide.
        </h2>

        <PauseOffscreen className="mt-14 grid gap-4 md:mt-16 md:grid-cols-2">
          {PLANOS.map((plano, index) => (
            <LiquidGlass
              key={plano.nome}
              as="article"
              className={`flex flex-col rounded-3xl p-8 md:p-10 ${
                plano.destaque ? "ring-1 ring-[var(--app-tint)]/25" : ""
              }`}
              delaySeconds={2 + index * 1.6}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="[font-family:var(--font-hanken)] text-xl font-bold tracking-tight">
                  {plano.nome}
                </h3>
                {plano.destaque ? (
                  <span className="rounded-full bg-[var(--app-tint)]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-tint)]">
                    Mais escolhido
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                {plano.para}
              </p>

              <p className="mt-7 flex items-baseline gap-1.5">
                <span className="[font-family:var(--font-jetbrains-mono)] text-4xl font-semibold tracking-tight md:text-5xl">
                  {plano.mensal}
                </span>
                <span className="text-sm text-[var(--app-text-muted)]">
                  por mês
                </span>
              </p>
              <p className="mt-1.5 text-sm text-[var(--app-text-muted)]">
                ou {plano.anual}
              </p>

              <ul className="mt-8 space-y-3 border-t border-white/[0.08] pt-7">
                {plano.inclui.map((item) => (
                  <li
                    key={item}
                    className="flex items-baseline gap-3 text-sm text-[var(--app-text)]/85"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-[var(--app-tint)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </LiquidGlass>
          ))}
        </PauseOffscreen>

        {/* The app says this on its own subscription screen. Repeating it here
            is the point: it is a promise, and a promise made only after someone
            has already paid is worth less. */}
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            "Sem contagem regressiva e sem preço riscado.",
            "Cancelar é um toque, na própria loja.",
            "Se cancelar, nada é apagado.",
          ].map((frase) => (
            <p
              key={frase}
              className="rounded-2xl border border-white/[0.07] px-5 py-4 text-sm leading-relaxed text-[var(--app-text-muted)]"
            >
              {frase}
            </p>
          ))}
        </div>

        {/* Reservado. Ver o bloco no topo deste arquivo: aqui entram os dois
            selos de loja e o QR code quando o aplicativo for publicado. */}
        <div
          id="lojas"
          className="mt-16 rounded-3xl border border-dashed border-white/12 px-8 py-10 text-center"
        >
          <p className="[font-family:var(--font-hanken)] text-lg font-semibold text-[var(--app-text)]">
            Em breve na App Store e no Google Play.
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--app-text-muted)]">
            A assinatura é feita dentro do aplicativo, pela loja do seu
            aparelho. O teste de sete dias começa no primeiro acesso.
          </p>
        </div>
      </div>
    </section>
  );
}
