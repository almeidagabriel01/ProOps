"use client";

import React from "react";
import { animate } from "motion/react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { cn } from "@/lib/utils";

interface TrocaComSaidaProps<T> {
  valor: T;
  chave: (valor: T) => string;
  children: (valor: T) => React.ReactNode;
  className?: string;
}

/**
 * Troca de conteúdo em que o antigo SAI antes de o novo montar.
 *
 * Existe no lugar de `<AnimatePresence mode="wait">`, que foi a primeira versão
 * e ficava presa: três trocas em sequência rápida (setas do teclado, toques
 * seguidos na roda) deixavam o conteúdo parado numa frase enquanto a roda já
 * mostrava outra, sem se recuperar. Aqui a regra é simples e verificável:
 *
 * - cada troca cancela a saída anterior e começa uma nova, a partir de onde a
 *   anterior parou (a opacidade não pisca de volta para 1);
 * - quando a saída termina, monta o valor MAIS RECENTE, porque o efeito que a
 *   agendou é descartado a cada troca, e só o último sobrevive.
 *
 * A saída é curta (0,16s) porque a rolagem não para durante ela: o conteúdo
 * novo monta com o progresso que a página já tem, e cada centésimo de saída é
 * animação que ninguém vê do conteúdo novo. Quem usa isso numa cena rolada
 * ainda reserva um trecho de espera no começo da fatia (`ESPERA`).
 *
 * O novo conteúdo entra sem animação própria de invólucro: as cenas e a
 * leitura já escrevem o próprio estado inicial ao montar, e animar o
 * invólucro por cima disso atrasaria a primeira coisa que elas mostram.
 */
export function TrocaComSaida<T>({
  valor,
  chave,
  children,
  className,
}: TrocaComSaidaProps<T>) {
  const reduzido = useReducedMotion();
  const caixa = React.useRef<HTMLDivElement>(null);
  const [exibido, setExibido] = React.useState(valor);
  const pendente = chave(valor) !== chave(exibido);

  React.useEffect(() => {
    const el = caixa.current;
    if (!pendente) {
      // A pessoa voltou para o que já estava na tela no meio de uma saída: o
      // conteúdo fica, e só precisa voltar a aparecer.
      if (el?.style.opacity) {
        const volta = animate(
          el,
          { opacity: 1, filter: "blur(0px)", y: 0 },
          { duration: 0.2 },
        );
        return () => volta.stop();
      }
      return;
    }
    let descartado = false;
    // Com a aba oculta o navegador não entrega quadros, e uma saída animada
    // esperaria para sempre: a troca acontece seca.
    const saida =
      el && !reduzido && !document.hidden
        ? animate(
            el,
            { opacity: 0, filter: "blur(10px)", y: -10 },
            { duration: 0.16, ease: [0.4, 0, 1, 1] },
          )
        : null;
    Promise.resolve(saida?.finished).then(() => {
      if (!descartado) setExibido(valor);
    });
    return () => {
      descartado = true;
      saida?.stop();
    };
  }, [pendente, valor, reduzido]);

  // O invólucro volta ao repouso no mesmo quadro em que o novo conteúdo monta.
  // Pelo próprio `animate`, e não limpando o `style`: o Motion guarda os
  // valores do elemento, e com a limpeza por fora a próxima saída partiria de
  // opacidade 0, ou seja, aconteceria sem ninguém ver.
  React.useLayoutEffect(() => {
    const el = caixa.current;
    if (!el || !el.style.opacity) return;
    animate(el, { opacity: 1, filter: "blur(0px)", y: 0 }, { duration: 0 });
  }, [exibido]);

  return (
    <div ref={caixa} className={cn(className)}>
      <React.Fragment key={chave(exibido)}>{children(exibido)}</React.Fragment>
    </div>
  );
}
