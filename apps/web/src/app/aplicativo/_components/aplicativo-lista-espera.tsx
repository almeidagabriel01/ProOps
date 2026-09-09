import { APP_NAME } from "@/lib/site/app-brand";

/**
 * Destination of every CTA on the page.
 *
 * The form itself lands with the backend, in its own phase. This exists now so
 * the anchors in the navbar and the hero resolve instead of scrolling to
 * nothing, and so the page has an ending.
 */
export function AplicativoListaEspera() {
  return (
    <section
      id="lista-de-espera"
      className="border-t border-white/10 bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="[font-family:var(--font-hanken)] text-3xl font-bold tracking-[-0.02em] md:text-5xl">
          Avisamos quando abrir.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-[var(--app-text-muted)]">
          O {APP_NAME} ainda não está nas lojas. Deixe seu e-mail e você é
          avisado no lançamento, sem mais nada no meio.
        </p>

        <p className="mt-10 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-amber-400"
          />
          Formulário entra com o backend
        </p>
      </div>
    </section>
  );
}
