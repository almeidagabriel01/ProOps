"use client";

import React from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { scrollToOffset } from "@/lib/landing/smooth-scroll";

import {
  indiceDaFatia,
  progressoComEntrada,
  progressoDaParada,
} from "./fatias";

/**
 * Uma cena grudada cuja lista avança com a rolagem.
 *
 * O palco é `sticky` dentro de um contêiner alto (`trilho`), e a altura do
 * trilho é o que dá rolagem às fatias. `sticky` e não `pin` pelo mesmo motivo
 * de `aplicativo-conversa.tsx`: a página já tem dois pins, e `sticky` não mede
 * nada. A regra que vem junto: nenhum ancestral do palco pode ter `overflow`.
 *
 * O palco gruda LOGO ABAIXO da barra fixa (`TOPO_DO_PALCO`) e alinha o
 * conteúdo pelo topo. Com o palco da altura da tela inteira e o conteúdo
 * centralizado nele, sobrava um vão de meia tela entre o título da seção e o
 * conteúdo, justamente no primeiro quadro que a pessoa vê.
 *
 * ── Peso ───────────────────────────────────────────────────────────────────
 *
 * O progresso passa por uma mola antes de chegar às cenas. Cru, ele segue a
 * roda do mouse tique a tique, e um giro rápido atravessava três frases antes
 * de a pessoa ler a primeira; com a mola a cena acompanha com atraso curto e
 * assenta, que é a sensação de algo com massa. O índice sai do MESMO valor
 * suavizado, senão a frase trocaria antes de a animação dela terminar.
 *
 * Sob `prefers-reduced-motion` não há trilho nem rolagem dirigida: o índice
 * passa a ser estado comum, trocado por clique, e as cenas ficam no estado
 * final. `animado` diz em qual dos dois modos a cena está.
 */
export function useCenaRolada(total: number) {
  const trilho = React.useRef<HTMLDivElement>(null);
  const { progress: bruto, animated } = useScrollProgress(trilho, {
    start: `top ${TOPO_DO_PALCO}px`,
    end: "bottom bottom",
    fallback: 0,
  });
  const progress = useSpring(bruto, MOLA);
  // A aproximação: do trilho aparecer na tela até o palco grudar. É nela que a
  // primeira fatia se monta (ver `progressoComEntrada`).
  const { progress: entradaBruta } = useScrollProgress(trilho, {
    start: "top 85%",
    end: `top ${TOPO_DO_PALCO}px`,
    fallback: 1,
  });
  const entrada = useSpring(entradaBruta, MOLA);

  const [indiceRolado, setIndiceRolado] = React.useState(0);
  const [indiceEscolhido, setIndiceEscolhido] = React.useState(0);

  // No máximo `total` renders ao longo da cena inteira: o estado só muda
  // quando a fatia muda, e o React descarta o set com o mesmo valor.
  useMotionValueEvent(progress, "change", (v) =>
    setIndiceRolado(indiceDaFatia(v, total)),
  );

  /** Leva a página a um ponto do trilho, dado como progresso 0..1. */
  const rolarPara = React.useCallback(
    (alvo: number, { imediato = false }: { imediato?: boolean } = {}) => {
      const el = trilho.current;
      if (!el) return;
      const inicio =
        el.getBoundingClientRect().top + window.scrollY - TOPO_DO_PALCO;
      const alcance = el.offsetHeight - (window.innerHeight - TOPO_DO_PALCO);
      scrollToOffset(inicio + alvo * alcance, { immediate: imediato });
    },
    [],
  );

  const escolher = React.useCallback(
    (indice: number) => {
      if (!animated) {
        setIndiceEscolhido(indice);
        return;
      }
      rolarPara(progressoDaParada(indice, total));
    },
    [animated, rolarPara, total],
  );

  return {
    trilho,
    progresso: progress,
    entrada,
    animado: animated,
    indice: animated ? indiceRolado : indiceEscolhido,
    escolher,
    rolarPara,
  };
}

/**
 * Onde o palco gruda, em px: a altura da barra fixa mais um respiro. Precisa
 * bater com o `6rem` do `top` em `CLASSE_DO_PALCO`.
 */
export const TOPO_DO_PALCO = 96;

/**
 * O palco grudado: colado sob a barra, com a altura do que sobra da tela e o
 * conteúdo centralizado nela.
 *
 * Centralizado de `md` para cima, e não no topo: com o cabeçalho dentro do
 * palco o conjunto ficou mais alto, e alinhado ao topo sobrava um vão de meia
 * tela embaixo, que é o que a cena tinha antes em cima.
 *
 * No celular ele volta a alinhar pelo topo, porque ali o conjunto é MAIS alto
 * que a tela: centralizado, a sobra vira corte dos dois lados, e o primeiro a
 * sumir é o título.
 */
/**
 * ── Por que ALTURA MÍNIMA, e o topo que se ajusta ───────────────────────────
 *
 * O palco já teve altura fixa (`100svh - 6rem`), e isso não sobrevive fora da
 * máquina em que foi medido. No iPhone SE a fatia mais alta sobrava com 22px;
 * no Linux do CI a mesma frase quebrou diferente e transbordou 28. Um celular
 * com a fonte do sistema aumentada, que é ajuste de acessibilidade comum,
 * transborda mais ainda. Palco de altura fixa com texto dentro é uma aposta na
 * métrica de fonte de quem lê, e a ficha, que é a resposta da cena, era o
 * primeiro a ficar cortada embaixo.
 *
 * Então a altura é MÍNIMA: quando o conteúdo cabe, o palco ocupa a tela como
 * antes e nada muda. Quando não cabe, ele cresce, e o topo da cola sobe na
 * medida exata para a borda de baixo continuar na borda da tela:
 * `min(6rem, 100svh - altura)`. Quem sai de vista, nesse caso, é o começo do
 * título, atrás da barra, e nunca a ficha. A altura vem de
 * `useAlturaDoPalco`; antes dela ser medida (servidor, primeiro quadro), o
 * padrão `0px` faz o `min` valer `6rem`, que é o comportamento antigo.
 */
export const CLASSE_DO_PALCO =
  "sticky top-[min(6rem,calc(100svh_-_var(--altura-do-palco,0px)))] flex min-h-[calc(100svh-6rem)] flex-col justify-start gap-4 md:justify-center md:gap-7";

/**
 * Escreve a altura real do palco em `--altura-do-palco`, que é de onde o `top`
 * de `CLASSE_DO_PALCO` tira o quanto precisa subir.
 *
 * `ResizeObserver`, e não uma medida só: a altura muda a cada frase (a ficha
 * tem de dois a quatro campos) e com a fonte carregando depois do primeiro
 * quadro. `offsetHeight` ignora transformações, então as animações de dentro
 * não mexem na conta.
 */
export function useAlturaDoPalco(
  palco: React.RefObject<HTMLElement | null>,
  ativo: boolean,
): void {
  React.useLayoutEffect(() => {
    const el = palco.current;
    if (!el || !ativo) return;
    const escrever = () =>
      el.style.setProperty("--altura-do-palco", `${el.offsetHeight}px`);
    escrever();
    const observador = new ResizeObserver(escrever);
    observador.observe(el);
    return () => {
      observador.disconnect();
      el.style.removeProperty("--altura-do-palco");
    };
  }, [palco, ativo]);
}

/**
 * A altura do trilho: a do palco, mais a rolagem de todas as fatias. É o que o
 * ScrollTrigger mede de `top 96px` até `bottom bottom`.
 */
export function alturaDoTrilho(total: number, fatiaSvh: number): string {
  return `calc(100svh - ${TOPO_DO_PALCO}px + ${total * fatiaSvh}svh)`;
}

/**
 * A mola do progresso.
 *
 * Responsiva: quem dá lentidão à cena é o tamanho da fatia, não o atraso da
 * mola. Com 45 de rigidez a cena inteira respondia com atraso visível, e a
 * troca de tópico parecia pesada; aqui ela só tira o degrau de cada tique da
 * roda do mouse.
 */
const MOLA = { stiffness: 110, damping: 26, mass: 0.7, restDelta: 0.0001 };

/**
 * O progresso da animação de UMA fatia, já sem a pausa de leitura.
 *
 * Fora do modo rolado vale 1 para sempre: é o estado final, que é o que a
 * cena mostra para quem pediu menos movimento.
 */
export function useProgressoDaFatia(
  progresso: MotionValue<number>,
  entrada: MotionValue<number>,
  indice: number,
  total: number,
  animado: boolean,
): MotionValue<number> {
  const completo = useMotionValue(1);
  const daFatia = useTransform(() =>
    progressoComEntrada(progresso.get(), entrada.get(), indice, total),
  );
  return animado ? daFatia : completo;
}
