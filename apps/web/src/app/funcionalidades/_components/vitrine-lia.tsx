"use client";

import React, { useRef } from "react";
import gsap from "gsap";

import { HidratarPerto } from "@/components/marketing/_shared/hidratar-perto";
import { JanelaDoErp } from "@/components/marketing/mocks/janela-do-erp";
import { CENA_REPETE, SCENE_ANY_WIDTH, useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";
import { TelaLia } from "@/components/marketing/mocks/telas/telas-do-erp";

/**
 * A Lia fazendo o trabalho: o pedido chega, ela mostra o que vai fazer, a
 * pessoa confirma, a parcela vira "Pago". A ordem é o argumento, porque é o
 * que a separa de um chat que só responde: nada é gravado antes do "Confirmar".
 *
 * Escrita no estado final (ver `.vitrine-lia` no CSS). A cena toca de novo a
 * cada chegada (`CENA_REPETE`), e sob movimento reduzido não existe.
 */
function Cena() {
  const escopo = useRef<HTMLElement>(null);

  useScrollScene(escopo, () => {
    const q = gsap.utils.selector(escopo.current);
    const tl = gsap.timeline({
      defaults: { ease: "expo.out", duration: 0.6 },
      scrollTrigger: { trigger: escopo.current, start: "top 70%", toggleActions: CENA_REPETE },
    });
    tl.fromTo(q('[data-mk="pedido"]'), { autoAlpha: 0, y: 18, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1 })
      .fromTo(q('[data-mk="confirmacao"]'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0 }, "+=0.35")
      .fromTo(
        q('[data-mk="confirmar"]'),
        { scale: 1 },
        { scale: 0.92, duration: 0.14, ease: "power2.in", yoyo: true, repeat: 1 },
        "+=0.55",
      )
      .fromTo(q('[data-mk="status-aberto"]'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, "+=0.05")
      .fromTo(
        q('[data-mk="status-pago"]'),
        { autoAlpha: 0, scale: 0.7 },
        { autoAlpha: 1, scale: 1, duration: 0.45, ease: "expo.out" },
        "<",
      )
      .fromTo(q('[data-mk="linha-alvo"]'), { backgroundColor: "rgba(127,127,127,0.14)" }, { backgroundColor: "rgba(127,127,127,0)", duration: 1.2, ease: "power1.out" }, "<")
      .fromTo(q('[data-mk="resposta"]'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0 }, "<0.2");
  }, { query: SCENE_ANY_WIDTH });

  return (
    <figure ref={escopo} className="vitrine-lia">
      <JanelaDoErp proporcao="16 / 10">
        <TelaLia />
      </JanelaDoErp>
      <figcaption className="mt-4 max-w-xl text-sm leading-relaxed text-black/55 dark:text-white/55">
        Pedido em português, confirmação antes de gravar e a parcela baixada no financeiro. A Lia só faz o que a
        pessoa que pediu teria permissão para fazer.
      </figcaption>
    </figure>
  );
}

export function VitrineLia() {
  return (
    <HidratarPerto>
      <Cena />
    </HidratarPerto>
  );
}
