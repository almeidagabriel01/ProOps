import { APP_NAME } from "@/lib/site/app-brand";

const TELAS = ["Hoje", "Financeiro", "Cartões", "Agente"];

/**
 * Where the real screenshots go.
 *
 * The hero rebuilds one screen in HTML because it has to move. This gallery is
 * the opposite job: proving the product exists, which only actual captures do.
 * They come from the app's `design-preview` route, which renders the real
 * screens with sample data and no login.
 *
 * The frames are drawn at the right aspect ratio now so that dropping the
 * images in later does not move anything on the page.
 */
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

        <ul className="mt-14 grid grid-cols-2 gap-4 md:mt-16 md:grid-cols-4">
          {TELAS.map((tela) => (
            <li key={tela}>
              <div className="flex aspect-[9/19.5] items-center justify-center rounded-[1.75rem] border border-dashed border-white/15 bg-[var(--app-surface)]">
                <span className="text-xs text-[var(--app-text-muted)]">
                  {tela}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
