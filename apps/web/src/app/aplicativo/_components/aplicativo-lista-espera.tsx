"use client";

import React from "react";

import { Loader } from "@/components/ui/loader";
import { AppWaitlistService } from "@/services/app-waitlist-service";
import { APP_NAME } from "@/lib/site/app-brand";

type Estado = "parado" | "enviando" | "pronto" | "erro";

/**
 * The one thing this page asks for.
 *
 * The app is not in either store, so there is nothing to download and no
 * checkout to send anyone to: the only honest conversion here is an address to
 * write to on launch day. One field, and no second ask.
 *
 * On success the form is replaced rather than merely disabled. A submitted
 * form that still looks submittable is the most common way people send the
 * same thing three times.
 */
export function AplicativoListaEspera() {
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [estado, setEstado] = React.useState<Estado>("parado");
  const [erro, setErro] = React.useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (estado === "enviando") return;

    setEstado("enviando");
    setErro(null);

    try {
      await AppWaitlistService.join({ email: email.trim(), website });
      setEstado("pronto");
    } catch (causa) {
      setEstado("erro");
      setErro(
        causa instanceof Error && causa.message
          ? causa.message
          : "Não conseguimos registrar agora. Tente de novo em um instante.",
      );
    }
  }

  return (
    <section
      id="lista-de-espera"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="[font-family:var(--font-hanken)] text-3xl font-bold tracking-[-0.02em] md:text-5xl">
          Avisamos quando abrir.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-[var(--app-text-muted)]">
          O {APP_NAME} ainda não está nas lojas. Deixe seu e-mail e você é
          avisado no lançamento, sem mais nada no meio.
        </p>

        {estado === "pronto" ? (
          <div
            role="status"
            className="mx-auto mt-10 max-w-md rounded-2xl border border-[var(--app-tint)]/30 bg-[var(--app-tint)]/10 px-6 py-6"
          >
            <p className="[font-family:var(--font-hanken)] text-lg font-semibold text-[var(--app-tint)]">
              Pronto, você está na lista.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
              Escrevemos uma vez, no lançamento. Nada além disso.
            </p>
          </div>
        ) : (
          <form
            onSubmit={enviar}
            noValidate
            className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="waitlist-email" className="sr-only">
              Seu e-mail
            </label>
            <input
              id="waitlist-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              aria-describedby={erro ? "waitlist-erro" : undefined}
              aria-invalid={estado === "erro" || undefined}
              // 16px on the phone: anything smaller makes iOS zoom the page in
              // when the field takes focus, and the viewport cannot be locked
              // without breaking pinch-to-zoom.
              className="min-w-0 flex-1 rounded-full border border-white/12 bg-[var(--app-element)] px-5 py-3.5 text-base text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/70 focus-visible:border-[var(--app-tint)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/30 md:text-sm"
            />

            {/* Honeypot: off-screen and out of the tab order, never shown. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="pointer-events-none absolute left-[-9999px] h-px w-px opacity-0"
            />

            <button
              type="submit"
              disabled={estado === "enviando"}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--app-tint)] px-7 py-3.5 text-sm font-semibold text-[var(--app-on-tint)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/60 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {estado === "enviando" ? (
                <>
                  <Loader size="sm" variant="button" />
                  Enviando
                </>
              ) : (
                "Quero ser avisado"
              )}
            </button>
          </form>
        )}

        {estado === "erro" && erro ? (
          <p
            id="waitlist-erro"
            role="alert"
            className="mx-auto mt-4 max-w-md text-sm text-[var(--app-danger)]"
          >
            {erro}
          </p>
        ) : null}

        <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-[var(--app-text-muted)]/80">
          Guardamos só o e-mail, e só para esse aviso. Em breve na App Store e
          no Google Play.
        </p>
      </div>
    </section>
  );
}
