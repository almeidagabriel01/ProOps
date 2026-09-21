import Image from "next/image";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { APP_NAME } from "@/lib/site/app-brand";

/**
 * O aparelho do herói: a captura real da aba Hoje, montada em cena.
 *
 * A tela é a captura e não a réplica em DOM (`telas/tela-hoje.tsx`): acima da
 * dobra a comparação com o produto é direta, e ali qualquer diferença de
 * fonte, espaçamento ou ícone lê como "não é o aplicativo de verdade". As
 * réplicas continuam nas cenas de baixo, onde o que importa é a tela mudar com
 * o scroll.
 *
 * O que mudou foi o resto do quadro. A captura sozinha, centrada, lia como
 * print colado: nada dizia que aquilo tinha vindo de uma mensagem. Agora o
 * aparelho está no meio de uma cena que conta a história da página em uma
 * imagem, e que é toda CSS, sem JavaScript nenhum acima da dobra:
 *
 * - a luz atrás separa o aparelho do fundo preto (os dois anéis que já
 *   estiveram aqui saíram: viravam dois ovais frouxos em volta da moldura);
 * - a mensagem do WhatsApp entra pela esquerda e o lançamento confirmado pela
 *   direita, nos dois lados da moldura, com um flutuar lento e defasado;
 * - `inclina-ponteiro` inclina o conjunto seguindo `--px`/`--py`, que o
 *   `PointerFieldProvider` da página já escreve uma vez por quadro. Sem
 *   ponteiro fino, e sob movimento reduzido, ele não inclina nada.
 *
 * As duas peças flutuantes só existem de `sm` para cima: num celular elas
 * cobririam a própria tela que vieram apresentar.
 */
export function AppHeroPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[20rem] sm:max-w-[21rem]">
      {/* A luz. Fica atrás de tudo e não recebe ponteiro. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-16 -inset-y-12 rounded-[999px] bg-[radial-gradient(60%_50%_at_50%_45%,var(--app-tint)_0%,transparent_70%)] opacity-[0.14] blur-3xl"
      />
      <div
        className="inclina-ponteiro relative"
        style={{ "--inclina": "4deg" } as React.CSSProperties}
      >
        <DeviceFrame platform="ios">
          <Image
            src="/mockup-ios/hoje.jpg"
            alt={`Tela inicial da ${APP_NAME}, com a sobra projetada do mês e as pendências do dia`}
            fill
            sizes="(min-width: 1024px) 21rem, (min-width: 640px) 60vw, 80vw"
            priority
            className="object-cover"
          />
        </DeviceFrame>

        {/* O pedido, do jeito que ele chega. */}
        <div
          className="app-flutua hero-enter absolute -left-12 top-[7%] hidden w-[13.5rem] rounded-2xl rounded-bl-md border border-white/[0.08] bg-[var(--app-surface)]/95 p-3 shadow-[0_26px_60px_-24px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:block lg:-left-20"
          style={
            {
              "--hero-y": "18px",
              "--hero-delay": "0.55s",
              "--flutua-dur": "7s",
            } as React.CSSProperties
          }
        >
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[var(--app-tint)]"
            />
            WhatsApp
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-[var(--app-text)]">
            gastei 45 no mercado
          </p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[var(--app-text-muted)]">
            12:31
            <svg
              viewBox="0 0 20 12"
              aria-hidden="true"
              className="h-2.5 w-4 fill-none stroke-[var(--app-tint)]"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 6.4 4.2 9.6 10.4 2.6" />
              <path d="M8.6 6.4 11.8 9.6 18 2.6" />
            </svg>
          </p>
        </div>

        {/* O que o aplicativo fez com ele. */}
        <div
          className="app-flutua hero-enter absolute -right-10 bottom-[12%] hidden w-[12.5rem] rounded-2xl border border-white/[0.08] bg-[var(--app-surface)]/95 p-3 shadow-[0_26px_60px_-24px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:block lg:-right-16"
          style={
            {
              "--hero-y": "18px",
              "--hero-delay": "0.75s",
              "--flutua-dur": "8.5s",
              "--flutua-atraso": "-2.5s",
            } as React.CSSProperties
          }
        >
          <p className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--app-tint)]/15"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 stroke-[var(--app-tint)]"
              >
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </span>
            <span className="text-[12px] font-medium leading-tight text-[var(--app-text)]">
              Despesa lançada
            </span>
          </p>
          <p className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-[var(--app-text-muted)]">
              Alimentação
            </span>
            <span className="[font-family:var(--font-jetbrains-mono)] text-[13px] font-semibold text-[var(--app-text)]">
              R$ 45,00
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
