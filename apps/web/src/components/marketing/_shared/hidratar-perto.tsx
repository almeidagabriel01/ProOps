"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Liga o JavaScript de uma seção só quando ela chega perto da tela, mantendo
 * o HTML do servidor visível até lá.
 *
 * ── Por que existe ─────────────────────────────────────────────────────────
 *
 * `next/dynamic` divide QUANDO o JavaScript de uma seção chega, e não quando
 * ela hidrata. Na landing do aplicativo as seções abaixo da dobra hidratavam
 * todas no carregamento, a várias telas de distância, e cada uma que ganhava
 * animação somava uma tarefa longa do `react-dom` à janela que o Lighthouse
 * mede. Foi assim que a página foi de 308ms de TBT para 969 no CI sem nenhuma
 * peça individualmente cara.
 *
 * ── Como ─────────────────────────────────────────────────────────────────
 *
 * Durante a hidratação o componente renderiza o próprio `div` com
 * `dangerouslySetInnerHTML` vazio. O React não hidrata nem corrige os filhos
 * de um elemento assim: o HTML do servidor fica exatamente como chegou, sem
 * JavaScript ligado. Quando a seção chega a `margem` da tela, o estado muda e
 * o React monta os filhos de verdade, no lugar daquele HTML.
 *
 * Nada muda na tela: as seções desta página são renderizadas no servidor no
 * estado FINAL (a regra da casa para movimento reduzido), e a troca acontece
 * fora da tela, uma tela e meia antes. O que fica adiado é o JavaScript:
 * animação, rolagem dirigida, efeitos.
 *
 * ── Por que não `Suspense` ──────────────────────────────────────────────────
 *
 * Foi a primeira versão, e é a receita mais citada: uma fronteira que suspende
 * na hidratação mantém o HTML do servidor. Aqui ela apagava a seção. Com o
 * RSC, o conteúdo da fronteira pode chegar do servidor PENDENTE (`<!--$?-->`,
 * completado por streaming), porque carregar um módulo de cliente suspende a
 * renderização no servidor; e uma fronteira nesse estado, suspensa de novo no
 * cliente, era renderizada do zero com o `fallback`. As seções ficavam vazias,
 * com altura zero, sem erro nem aviso. Como o E2E roda no servidor de dev,
 * onde isso acontece sempre, não havia como depender do caso em que a
 * fronteira chega completa.
 *
 * ── Só na hidratação ──────────────────────────────────────────────────────
 *
 * Numa montagem do lado do cliente (navegação) não há HTML do servidor a
 * preservar, e o placeholder deixaria a seção EM BRANCO até entrar na tela.
 * Por isso o adiamento só vale na hidratação do documento, detectada por
 * `documentoHidratado`: todas as instâncias renderizam antes de qualquer
 * efeito rodar, então na hidratação todas o veem desligado, e numa navegação
 * posterior ele já está ligado. No servidor nunca adia.
 *
 * ⚠️ Não troque isso por `useSyncExternalStore` com valores diferentes no
 * servidor e no cliente, que é a receita conhecida para "estou hidratando?":
 * ela força uma renderização extra logo depois de hidratar, e aqui qualquer
 * renderização fora de hora mexe no placeholder.
 *
 * ── `apenasEm` ──────────────────────────────────────────────────────────────
 *
 * Seção que cria um `pin` do ScrollTrigger não pode ser adiada onde o pin
 * existe. O pin insere um espaçador do tamanho da rolagem dele, e se isso
 * acontecesse com a seção ACIMA da tela (quem pulou para `#planos` pela barra
 * e depois subiu), todo o conteúdo abaixo desceria de uma vez. Para essas,
 * `apenasEm` restringe o adiamento às larguras em que não há pin.
 *
 * ── Onde usar ──────────────────────────────────────────────────────────────
 *
 * DENTRO do módulo de cliente da seção, envolvendo o corpo dela, e não na
 * página. Filhos passados por um componente de servidor atravessam a fronteira
 * do RSC como referências. E só em componente de cliente: componente de
 * servidor não hidrata, então não há o que adiar.
 */
interface HidratarPertoProps {
  children: React.ReactNode;
  /** Antecedência da montagem, no formato de `rootMargin`. */
  margem?: string;
  /** Media query em que o adiamento vale. Fora dela, hidrata na hora. */
  apenasEm?: string;
}

/**
 * Ligado no primeiro efeito de qualquer instância, ou seja, depois que a
 * hidratação do documento terminou de montar. É estado do DOCUMENTO, e por
 * isso vive no módulo e não num componente.
 */
let documentoHidratado = false;

export function HidratarPerto({
  children,
  margem = "150% 0px",
  apenasEm,
}: HidratarPertoProps) {
  const [adiar] = useState(
    () =>
      typeof window !== "undefined" &&
      // Sem observador não há como saber quando montar: não adia.
      typeof IntersectionObserver !== "undefined" &&
      !documentoHidratado &&
      (!apenasEm || window.matchMedia(apenasEm).matches),
  );
  const [montado, setMontado] = useState(!adiar);
  const ancora = useRef<HTMLDivElement>(null);

  useEffect(() => {
    documentoHidratado = true;
  }, []);

  // `data-vivo` diz que o JavaScript da seção está ligado. Antes dele, o que
  // está na tela é o HTML do servidor: igual à vista, mas sem nada que
  // responda a clique ou teclado. Existe para quem precisa saber disso de
  // fora, e o E2E é o principal: um teste que rola até a seção e clica na hora
  // clicaria no HTML que está para ser trocado, e o clique se perderia.
  useEffect(() => {
    if (montado) ancora.current?.setAttribute("data-vivo", "");
  }, [montado]);

  useEffect(() => {
    const el = ancora.current;
    if (montado || !el) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setMontado(true);
      },
      { rootMargin: margem },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [montado, margem]);

  // Um `div` de verdade, e não `display: contents`: é ele que o
  // IntersectionObserver observa, e um elemento sem caixa nunca cruza a tela.
  if (!montado) {
    return (
      <div
        ref={ancora}
        data-hidratar-perto=""
        // O HTML de dentro é o do servidor, e diferir dele é o objetivo.
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />
    );
  }
  return (
    <div ref={ancora} data-hidratar-perto="">
      {children}
    </div>
  );
}
