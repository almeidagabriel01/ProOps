"use client";

import React from "react";

import { scrollToOffset } from "@/lib/landing/smooth-scroll";

import { escolheCanal } from "./canal-escolhido";

/** O id da seção do formulário, que é o destino de toda conversa do herói. */
export const ALVO_DO_FORMULARIO = "escreva";

/**
 * Uma conversa do herói, como link para o formulário com o assunto já escolhido.
 *
 * É um `<a href="#escreva">` de verdade: sem JavaScript (ou antes de hidratar)
 * ele ainda leva ao formulário, só que no assunto padrão. Com JavaScript, o
 * clique escolhe o assunto no store compartilhado, rola pelo Lenis (um salto de
 * âncora nativo passaria por fora dele e deixaria as cenas no progresso antigo)
 * e põe o foco no rádio do assunto, para quem veio pelo teclado continuar dali.
 */
export function FioDaConversa({
  titulo,
  className,
  children,
}: {
  titulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  const abre = (evento: React.MouseEvent<HTMLAnchorElement>) => {
    const alvo = document.getElementById(ALVO_DO_FORMULARIO);
    if (!alvo) return;
    evento.preventDefault();
    escolheCanal(titulo);
    scrollToOffset(alvo.getBoundingClientRect().top + window.scrollY - 24);
    // O rádio só existe marcado depois do render que o store acabou de pedir.
    requestAnimationFrame(() => {
      alvo
        .querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        ?.focus({ preventScroll: true });
    });
  };

  return (
    <a href={`#${ALVO_DO_FORMULARIO}`} onClick={abre} className={className}>
      {children}
    </a>
  );
}
