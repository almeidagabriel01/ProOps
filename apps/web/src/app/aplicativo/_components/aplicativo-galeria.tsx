import { APP_NAME } from "@/lib/site/app-brand";

import { DeviceFrame } from "./device-frame";

interface Tela {
  nome: string;
  plataforma: "ios" | "android";
  /** Path under public/ once the capture exists. Empty keeps the frame empty. */
  imagem?: string;
}

/**
 * Where the real screenshots go.
 *
 * The hero rebuilds one screen in HTML because it has to move. This is the
 * opposite job: proving the product exists, which only actual captures do.
 * They come from the app's `design-preview` route, which renders the real
 * screens with sample data and no login.
 *
 * The frames are already drawn at the right ratio and platform, so dropping the
 * images in later fills them without moving anything else on the page. Capture
 * in the DARK theme: this page is #131315 and a light capture fights it.
 */
const TELAS: Tela[] = [
  { nome: "Hoje", plataforma: "ios" },
  { nome: "Financeiro", plataforma: "ios" },
  { nome: "Cartões", plataforma: "android" },
  { nome: "Agente", plataforma: "android" },
];

export function AplicativoGaleria() {
  return (
    <section className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36">
      <div className="mx-auto max-w-5xl">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-amber-400"
          />
          Capturas reais pendentes
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          O {APP_NAME} por dentro.
        </h2>

        <ul className="mt-16 grid grid-cols-2 gap-8 md:mt-20 md:grid-cols-4 md:gap-6">
          {TELAS.map((tela) => (
            <li key={tela.nome}>
              <DeviceFrame
                platform={tela.plataforma}
                label={`Tela ${tela.nome} do ${APP_NAME}`}
              >
                {tela.imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tela.imagem}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-[var(--app-text-muted)]">
                    {tela.nome}
                  </span>
                )}
              </DeviceFrame>
              <p className="mt-4 text-center text-xs text-[var(--app-text-muted)]">
                {tela.nome}
                <span className="ml-1.5 opacity-60">
                  {tela.plataforma === "ios" ? "iOS" : "Android"}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
