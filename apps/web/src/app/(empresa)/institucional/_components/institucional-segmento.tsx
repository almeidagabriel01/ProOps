import React from "react";

import { BlocosRevelados } from "@/components/institucional/blocos-revelados";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Magnetic } from "@/components/marketing/_shared/magnetic";

import { NICHOS_PRONTOS, O_QUE_SE_CONFIGURA } from "../_content/institucional-copy";

/**
 * "O seu segmento": a seção que impede a página de parecer de dois nichos.
 *
 * A ProOps nasceu numa empresa de automação residencial, e o site contava essa
 * origem em três lugares. Quem vende outro tipo de projeto lia a origem como
 * FRONTEIRA e ia embora antes de falar com alguém, o que é o pior tipo de
 * perda: não é objeção, é um mal-entendido.
 *
 * Por isso a seção separa as duas coisas com todas as letras: o que já vem
 * pronto (dois pacotes) e o que é configurado (o resto). E lista o que muda de
 * um segmento para o outro, porque "a gente adapta" sozinho não é promessa
 * verificável; catálogo, campos, etapas e unidade de medida são.
 */
export function InstitucionalSegmento() {
  return (
    <Secao aria-label="O seu segmento">
      <div className="mx-auto max-w-6xl">
        <TituloSecao
          sobrancelha="O seu segmento"
          titulo={
            <>
              A ProOps não é de um nicho. É de quem <Realce>vende projeto</Realce>.
            </>
          }
          descricao="O ERP nasceu dentro de uma empresa de automação residencial porque foi ali que o problema apareceu na nossa frente. A origem não virou fronteira: hoje são dois segmentos que já vêm prontos, e qualquer outro é configurado na mesma base, com o catálogo e as palavras do negócio de quem chega."
          className="mb-14"
        />

        <ul className="mb-16 flex flex-wrap gap-3">
          {NICHOS_PRONTOS.map((nicho) => (
            <li
              key={nicho.rotulo}
              className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/80"
            >
              {nicho.rotulo}
              <span className="ml-2 text-white/40">{nicho.estado}</span>
            </li>
          ))}
          <li className="rounded-full border border-dashed border-[rgb(var(--tungstenio)/0.55)] px-4 py-2 text-sm text-[rgb(var(--tungstenio))]">
            O seu
            <span className="ml-2 text-white/45">configurado</span>
          </li>
        </ul>

        <BlocosRevelados blocos={[...O_QUE_SE_CONFIGURA]} numerado={false} colunas={2} />

        <div className="mt-14">
          <Magnetic>
            <LandingButton href="/contato" variant="inverted">
              Contar o que a sua empresa vende
            </LandingButton>
          </Magnetic>
        </div>
      </div>
    </Secao>
  );
}
