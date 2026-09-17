"use client";

import React from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

import { PEDIDOS, textoDoPedido, type Pedido } from "../../_content/comandos";
import { posicaoDaRoda, progressoDaPosicao } from "./fatias";
import { LeituraDoPedido } from "./leitura-do-pedido";
import { RodaDePedidos, type RodaNaRolagem } from "./roda-de-pedidos";
import { TrocaComSaida } from "./troca-com-saida";
import { useCenaRolada, useProgressoDaFatia } from "./use-cena-rolada";
import { useVisibilidade } from "./use-visibilidade";

const TOTAL = PEDIDOS.length;

/**
 * Rolagem de cada frase, em alturas de tela. Curta o bastante para as 16
 * caberem em uma sessão de leitura, longa o bastante para a digitação não
 * passar num piscar.
 */
const FATIA_SVH = 42;

const ITENS = PEDIDOS.map((pedido) => ({
  id: pedido.id,
  rotulo: textoDoPedido(pedido),
}));

/**
 * A primeira metade da seção: a roda de pedidos e a leitura da frase no centro
 * dela, as duas andando com a rolagem.
 *
 * O palco gruda na tela e cada frase ocupa uma fatia da rolagem. Descer
 * escreve a frase, acende as partes reconhecidas e monta a ficha; continuar
 * descendo gira a roda para a próxima. Subir desfaz tudo na ordem inversa.
 * A roda é o indicador dessa rolagem: tocar numa frase ou arrastar a roda leva
 * a PÁGINA até ela, e a leitura acompanha.
 *
 * A troca de frase sai desfocando e a próxima só monta depois
 * (`TrocaComSaida`): com as duas no quadro, os tokens da nova voariam por cima
 * da ficha da antiga.
 *
 * Sob movimento reduzido não há trilho: a roda vira um controle comum, a
 * leitura aparece pronta e a seção tem a altura do próprio conteúdo.
 */
export function LeituraAoVivo() {
  const { ref: palco, armado } = useVisibilidade<HTMLDivElement>();
  const { trilho, indice, escolher, rolarPara, animado, progresso } =
    useCenaRolada(TOTAL);
  const posicao = useTransform(progresso, (v) => posicaoDaRoda(v, TOTAL));

  const rolagem = React.useMemo<RodaNaRolagem | undefined>(
    () =>
      animado
        ? {
            posicao,
            aoArrastar: (p) =>
              rolarPara(progressoDaPosicao(p, TOTAL), { imediato: true }),
          }
        : undefined,
    [animado, posicao, rolarPara],
  );

  return (
    <div
      ref={trilho}
      style={
        animado
          ? { height: `calc(100svh + ${TOTAL * FATIA_SVH}svh)` }
          : undefined
      }
      className="relative"
    >
      <div
        ref={palco}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:items-center md:gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-16",
          // `pt-24`: a barra é fixa e cobre o topo da tela, então
          // sem o recuo o começo do palco fica atrás dela a cena inteira.
          animado &&
            "sticky top-0 h-[100svh] content-start pt-24 md:content-center",
        )}
      >
        <div>
          <div className="rounded-[1.75rem] border border-[var(--app-card-border)] bg-[var(--app-surface)]">
            <RodaDePedidos
              itens={ITENS}
              indice={indice}
              aoEscolher={escolher}
              rotulo="Pedidos de exemplo"
              rolagem={rolagem}
              className="h-[132px] md:h-[308px]"
            />
          </div>
          <Posicao
            indice={indice}
            progresso={animado ? progresso : undefined}
          />
        </div>

        {/* A altura mínima é a da maior leitura, medida com as 16 frases:
            506px em 1024 (a frase de duas linhas com quatro campos) e 459px a
            360 e 393. Sem ela o palco pularia a cada troca de frase. Frase nova
            mais longa: meça de novo. */}
        <div className="min-h-[29rem] md:min-h-[32rem]">
          <TrocaComSaida valor={indice} chave={String}>
            {(exibido) => (
              <LeituraNaFatia
                pedido={PEDIDOS[exibido]}
                indice={exibido}
                progresso={progresso}
                animado={animado}
                armado={armado}
              />
            )}
          </TrocaComSaida>
        </div>
      </div>
    </div>
  );
}

function LeituraNaFatia({
  pedido,
  indice,
  progresso,
  animado,
  armado,
}: {
  pedido: Pedido;
  indice: number;
  progresso: MotionValue<number>;
  animado: boolean;
  armado: boolean;
}) {
  const daFatia = useProgressoDaFatia(progresso, indice, TOTAL, animado);
  return (
    <LeituraDoPedido pedido={pedido} armado={armado} progresso={daFatia} />
  );
}

/**
 * Em que frase a pessoa está, e quanto da lista já passou.
 *
 * O número é o que orienta: com 16 frases, uma roda sozinha não diz se falta
 * pouco ou muito para a seção acabar.
 */
function Posicao({
  indice,
  progresso,
}: {
  indice: number;
  progresso?: MotionValue<number>;
}) {
  return (
    <div className="mt-3 flex items-center gap-3 px-2 md:mt-4">
      <p className="shrink-0 [font-family:var(--font-jetbrains-mono)] text-xs text-[var(--app-text-muted)] [font-variant-numeric:tabular-nums]">
        <span className="text-[var(--app-text)]">
          {String(indice + 1).padStart(2, "0")}
        </span>
        /{TOTAL}
      </p>
      <span
        aria-hidden="true"
        className="block h-px flex-1 overflow-hidden bg-[var(--app-text)]/[0.08]"
      >
        {progresso ? (
          <motion.span
            style={{ scaleX: progresso }}
            className="block h-full origin-left bg-[var(--app-tint)]"
          />
        ) : null}
      </span>
      <p className="hidden shrink-0 text-xs text-[var(--app-text-muted)] md:block">
        {progresso ? "Role ou arraste a roda" : "Escolha um pedido"}
      </p>
    </div>
  );
}
