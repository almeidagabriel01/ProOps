import React from "react";

import { LinhaHero } from "@/components/institucional/herois/heroi-titulo";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { SITE_URLS } from "@/lib/site/surfaces";

import { HEROI_RAIZ } from "../../_content/institucional-copy";
import { PermissaoDeMovimento } from "./permissao-de-movimento";

/** Atraso relativo à abertura: `--espera` é escrita pela seção. */
function depois(segundos: number): string {
  return `calc(var(--espera, 0s) + ${segundos}s)`;
}

/**
 * O texto da primeira dobra: título, apoio e os dois caminhos.
 *
 * Componente de servidor, com a entrada inteira em CSS (`.hero-rise-line`,
 * `.hero-enter`): é o elemento de LCP da página, e ele pinta e anima no
 * primeiro paint sem esperar bundle nenhum. As ilhas de cliente aqui dentro
 * (`Magnetic`, os botões, a permissão do giroscópio) hidratam depois sem que o
 * texto dependa delas.
 *
 * O nome acessível do `<h1>` começa por "ProOps": a marca é o que o título da
 * página diz primeiro para quem não vê a cena, e o E2E do site confere isso.
 */
export function TextoDoHeroi() {
  return (
    <div className="max-w-3xl">
      <h1 className="[font-family:var(--font-bricolage)] text-[clamp(2.4rem,5.6vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-white">
        <span className="sr-only">ProOps: </span>
        {HEROI_RAIZ.titulo.map((linha, i) => (
          <LinhaHero key={linha} atraso={depois(i * 0.09)}>
            {linha}
          </LinhaHero>
        ))}
      </h1>

      <p
        className="hero-enter mt-7 max-w-lg text-[15px] leading-relaxed text-white/70 md:mt-8 md:text-[17px]"
        style={
          {
            "--hero-y": "16px",
            "--hero-delay": depois(0.42),
          } as React.CSSProperties
        }
      >
        {HEROI_RAIZ.lead}
      </p>

      <div
        className="hero-enter mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6"
        style={
          {
            "--hero-y": "12px",
            "--hero-delay": depois(0.56),
            "--hero-dur": "0.5s",
          } as React.CSSProperties
        }
      >
        <Magnetic>
          <LandingButton href={SITE_URLS.erp} external variant="inverted" size="lg">
            Conhecer o ERP
          </LandingButton>
        </Magnetic>
        <LandingButton
          href={SITE_URLS.app}
          external
          variant="link"
          size="lg"
          className="text-white"
        >
          Conhecer o aplicativo
        </LandingButton>
      </div>

      <PermissaoDeMovimento />
    </div>
  );
}
