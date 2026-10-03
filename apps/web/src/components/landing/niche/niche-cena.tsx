"use client";

import React from "react";
import dynamic from "next/dynamic";

import { HidratarPerto } from "@/components/marketing/_shared/hidratar-perto";

import { Accent } from "../_shared/section-heading";
import type { ModuloDaCena } from "./cenas/tipos";
import type { CenaDoNicho } from "./types";

type Props<T extends CenaDoNicho["tipo"]> = {
  dados: Extract<CenaDoNicho, { tipo: T }>;
  modulos: readonly ModuloDaCena[];
};

/**
 * O mapa das cenas. Um `Record` do `tipo`: cena nova sem entrada aqui não
 * compila. Cada uma é um `next/dynamic` próprio, então a página de persianas
 * baixa só a cena de persianas, e nenhum componente pergunta de que nicho é.
 */
const CENAS: { [T in CenaDoNicho["tipo"]]: React.ComponentType<Props<T>> } = {
  "vao-persiana": dynamic(() => import("./cenas/cena-vao-persiana").then((m) => m.CenaVaoPersiana)),
  esquadria: dynamic(() => import("./cenas/cena-esquadria").then((m) => m.CenaEsquadria)),
  "modulo-planejado": dynamic(() => import("./cenas/cena-modulo-planejado").then((m) => m.CenaModuloPlanejado)),
  "planta-seguranca": dynamic(() => import("./cenas/cena-planta-seguranca").then((m) => m.CenaPlantaSeguranca)),
  "matriz-automacao": dynamic(() => import("./cenas/cena-matriz-automacao").then((m) => m.CenaMatrizAutomacao)),
  "split-instalacao": dynamic(() => import("./cenas/cena-split-instalacao").then((m) => m.CenaSplitInstalacao)),
};

interface NicheCenaProps {
  titulo: string;
  frase: string;
  dados: CenaDoNicho;
  modulos: readonly ModuloDaCena[];
}

/** A cena de assinatura do nicho, com o título dela. Hidrata perto da tela. */
export function NicheCena({ titulo, frase, dados, modulos }: NicheCenaProps) {
  const Cena = CENAS[dados.tipo] as React.ComponentType<{ dados: CenaDoNicho; modulos: readonly ModuloDaCena[] }>;
  // A última palavra leva o itálico da casa: "O vão que vira *preço*".
  const palavras = titulo.split(" ");
  const ultima = palavras.pop();
  return (
    <section
      data-cena={dados.tipo}
      className="border-t border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="max-w-3xl [font-family:var(--font-pdf-montserrat)] text-[2.1rem] font-bold leading-[1.06] tracking-[-0.025em] text-black dark:text-white md:text-5xl">
          {palavras.join(" ")} <Accent>{ultima}</Accent>.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/60 dark:text-white/60 md:text-lg">{frase}</p>
        <div className="mt-14">
          <HidratarPerto>
            <Cena dados={dados} modulos={modulos} />
          </HidratarPerto>
        </div>
      </div>
    </section>
  );
}
