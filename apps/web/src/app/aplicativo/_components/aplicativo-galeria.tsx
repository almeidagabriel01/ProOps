import Image from "next/image";

import { APP_NAME } from "@/lib/site/app-brand";

import { DeviceFrame } from "./device-frame";

interface Tela {
  nome: string;
  descricao: string;
  plataforma: "ios" | "android";
  imagem: string;
}

/**
 * The real screens, as proof.
 *
 * The hero rebuilds one screen in HTML because it has to move. This is the
 * opposite job, and only actual captures do it. They come from the app's
 * `design-preview` route, which renders the real screens with sample data and
 * no login.
 *
 * A snap-scrolling shelf rather than a grid: six screens in a four-up grid
 * leaves a ragged second row, and shrinking them to fit six across makes each
 * one unreadable. The shelf shows about four and a half, which is what invites
 * the scroll, and it needs no JavaScript on any width.
 */
const TELAS: Tela[] = [
  {
    nome: "Hoje",
    descricao: "Sobra projetada, vencimentos e o que a IA capturou",
    plataforma: "ios",
    imagem: "/mockup-ios/hoje.jpg",
  },
  {
    nome: "Financeiro",
    descricao: "O mês inteiro, com saldo projetado",
    plataforma: "ios",
    imagem: "/mockup-ios/financeiro.jpg",
  },
  {
    nome: "Lançamentos",
    descricao: "Busca, filtros e a origem de cada linha",
    plataforma: "ios",
    imagem: "/mockup-ios/financeiro2.jpg",
  },
  {
    nome: "Agenda",
    descricao: "Lembretes, com recorrência",
    plataforma: "ios",
    imagem: "/mockup-ios/agenda.jpg",
  },
  {
    nome: "Notas",
    descricao: "Pastas, tags e checklist",
    plataforma: "ios",
    imagem: "/mockup-ios/notas.jpg",
  },
  {
    nome: "Perfil",
    descricao: "WhatsApp conectado e a cota de IA por canal",
    plataforma: "ios",
    imagem: "/mockup-ios/perfil.jpg",
  },
];

export function AplicativoGaleria() {
  return (
    <section className="border-t border-white/[0.06] bg-[var(--app-bg)] py-28 text-[var(--app-text)] md:py-36">
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />
          Por dentro
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          O {APP_NAME}, tela por tela.
        </h2>
      </div>

      {/* Full-bleed shelf: the row runs past the container so the last screen
          is cut by the viewport edge rather than by a margin, which is what
          reads as "there is more" instead of "this is the end". */}
      <ul className="landing-scrollbar mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-8 md:mt-16 md:px-10">
        {TELAS.map((tela, index) => (
          <li
            key={tela.nome}
            className="w-[52%] shrink-0 snap-start sm:w-[33%] md:w-[23%] lg:w-[17%]"
          >
            <DeviceFrame platform={tela.plataforma}>
              <Image
                src={tela.imagem}
                alt={`Tela ${tela.nome} do ${APP_NAME}: ${tela.descricao}`}
                fill
                sizes="(min-width: 1024px) 17vw, (min-width: 768px) 23vw, 52vw"
                // The first two are near the fold on a wide screen; the rest
                // only exist once the shelf is scrolled.
                loading={index < 2 ? "eager" : "lazy"}
                className="object-cover"
              />
            </DeviceFrame>
            <p className="mt-4 [font-family:var(--font-hanken)] text-sm font-semibold">
              {tela.nome}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">
              {tela.descricao}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
