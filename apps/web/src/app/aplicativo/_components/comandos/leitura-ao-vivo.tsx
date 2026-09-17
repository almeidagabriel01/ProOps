"use client";

import React from "react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";

import { PEDIDOS, textoDoPedido } from "../../_content/comandos";
import { ControleDoRevezamento } from "./controle-do-revezamento";
import { LeituraDoPedido } from "./leitura-do-pedido";
import { RodaDePedidos } from "./roda-de-pedidos";
import { TrocaComSaida } from "./troca-com-saida";
import { useRevezamento } from "./use-revezamento";
import { useVisibilidade } from "./use-visibilidade";

/** Segundos de cada pedido: a leitura leva ~4,5s, o resto é tempo de ler. */
const DURACAO = 8;

const ITENS = PEDIDOS.map((pedido) => ({
  id: pedido.id,
  rotulo: textoDoPedido(pedido),
}));

/**
 * A primeira metade da seção: a roda de pedidos e a leitura do que está no
 * centro dela.
 *
 * A roda troca sozinha enquanto a pessoa só olha. Tocar, arrastar ou usar o
 * teclado nela desliga o automático, e dali em diante a frase é a que a pessoa
 * escolheu.
 *
 * A troca de frase sai desfocando e a próxima só monta depois (`TrocaComSaida`):
 * com as duas no quadro ao mesmo tempo, os tokens da nova voariam por cima da
 * ficha da antiga.
 */
export function LeituraAoVivo() {
  const { ref, armado, emVista } = useVisibilidade<HTMLDivElement>();
  const reduzido = useReducedMotion();
  const revezamento = useRevezamento(PEDIDOS.length);
  const pedido = PEDIDOS[revezamento.indice];

  return (
    <div
      ref={ref}
      className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:items-start md:gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-16"
    >
      <div className="md:sticky md:top-28">
        <div className="rounded-[1.75rem] border border-[var(--app-card-border)] bg-[var(--app-surface)]">
          <RodaDePedidos
            itens={ITENS}
            indice={revezamento.indice}
            aoEscolher={revezamento.escolher}
            rotulo="Pedidos de exemplo"
          />
        </div>
        {reduzido ? null : (
          <ControleDoRevezamento
            volta={revezamento.volta}
            duracao={DURACAO}
            rodando={revezamento.rodando}
            emVista={emVista}
            aoTerminar={revezamento.avancar}
            aoAlternar={revezamento.alternar}
            assunto="os pedidos"
            className="mt-4 px-2"
          />
        )}
        <p className="mt-3 px-2 text-xs text-[var(--app-text-muted)]">
          Arraste a roda ou escolha um pedido.
        </p>
      </div>

      {/* A altura mínima é a da maior leitura, medida com as 16 frases:
          506px em 1024 (a frase de duas linhas com quatro campos) e 459px a
          360 e 393. Sem ela a mesa de operações, logo abaixo, subiria e
          desceria a cada troca de frase. Frase nova mais longa: meça de novo. */}
      <div className="min-h-[29rem] md:min-h-[32rem]">
        <TrocaComSaida valor={pedido} chave={(p) => p.id}>
          {(exibido) => (
            <LeituraDoPedido
              pedido={exibido}
              armado={armado}
              tocando={emVista}
            />
          )}
        </TrocaComSaida>
      </div>
    </div>
  );
}
