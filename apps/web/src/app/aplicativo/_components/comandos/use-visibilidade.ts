"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dois sinais de visibilidade, com papéis diferentes.
 *
 * - `armado` liga UMA vez, quando a região chega a meia tela do viewport, e
 *   nunca mais desliga. É o momento de montar as timelines, que medem layout:
 *   cedo o bastante para o estado inicial já estar escrito quando a pessoa
 *   chega (sem ver o estado final piscar e sumir), e tarde o bastante para
 *   ficar fora da hidratação, que é onde a página já paga TBT demais.
 * - `emVista` acompanha se a região está de fato na tela. É o que dá o play e
 *   o que pausa o revezamento.
 *
 * Os dois começam `false`, inclusive no cliente. `usePauseOffscreen` começa em
 * `true`, e aqui isso seria errado: uma cena montaria a timeline na
 * hidratação, com a seção ainda a várias telas de distância.
 */
export function useVisibilidade<T extends HTMLElement>({
  margemDeArme = "0px 0px 50% 0px",
  limiar = 0.3,
}: { margemDeArme?: string; limiar?: number } = {}) {
  const ref = useRef<T>(null);
  const [armado, setArmado] = useState(false);
  const [emVista, setEmVista] = useState(false);

  useEffect(() => {
    const alvo = ref.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return;

    const arme = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setArmado(true);
        arme.disconnect();
      },
      { rootMargin: margemDeArme },
    );
    const vista = new IntersectionObserver(
      ([entrada]) => setEmVista(entrada.isIntersecting),
      { threshold: limiar },
    );
    arme.observe(alvo);
    vista.observe(alvo);
    return () => {
      arme.disconnect();
      vista.disconnect();
    };
  }, [margemDeArme, limiar]);

  return { ref, armado, emVista };
}
