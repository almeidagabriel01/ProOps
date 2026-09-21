"use client";

import React, { useId, useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { cn } from "@/lib/utils";

const SAIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Mesma máscara BR do resto do produto: (XX) XXXXX-XXXX. */
function mascaraTelefone(valor: string): string {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    digitos = digitos.slice(2);
  }
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
}

interface CampoDaConversaProps {
  rotulo: string;
  nome: string;
  valor: string;
  aoMudar: (nome: string, valor: string) => void;
  erro?: string;
  tipo?: "text" | "email" | "tel";
  obrigatorio?: boolean;
  multilinha?: boolean;
  autoComplete?: string;
  /** Escrito embaixo do campo quando ele está em foco. Some ao sair. */
  dica?: string;
  className?: string;
}

/**
 * Um campo desta superfície: sem caixa, só uma linha de base que se desenha.
 *
 * Primo do `FloatingField` de `/contato`, e não o mesmo componente, porque
 * aquele é de um tema claro/escuro com tokens do ERP e este vive sempre sobre o
 * quase-preto do site da empresa. Copiar os dois gestos (rótulo que flutua,
 * filete que se desenha) custa menos do que parametrizar um componente para
 * duas superfícies que vão divergir.
 *
 * `text-base` no campo não é escolha de tipografia: abaixo de 16px o iOS dá
 * zoom ao focar, e travar `maximum-scale` no viewport quebraria acessibilidade.
 * O guard `src/__tests__/mobile-input-font-size.test.ts` vigia isso.
 */
export function CampoDaConversa({
  rotulo,
  nome,
  valor,
  aoMudar,
  erro,
  tipo = "text",
  obrigatorio,
  multilinha,
  autoComplete,
  dica,
  className,
}: CampoDaConversaProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const [focado, setFocado] = useState(false);
  const flutuando = focado || valor.length > 0;

  const mudou = (
    evento: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const bruto = evento.target.value;
    aoMudar(nome, tipo === "tel" ? mascaraTelefone(bruto) : bruto);
  };

  const transicaoRotulo = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 34 };

  const classesCampo =
    "block w-full bg-transparent pt-7 text-base leading-tight text-white outline-none placeholder:text-transparent";

  return (
    <div className={cn("relative", className)}>
      {/* Rótulo como placeholder em repouso, flutuando para cima quando ativo.
          `pointer-events-none` porque quem clica nele quer o campo. */}
      <motion.label
        htmlFor={id}
        className="pointer-events-none absolute left-0 top-0 origin-left select-none text-base tracking-tight text-white/45"
        animate={{ y: flutuando ? 0 : 27, scale: flutuando ? 0.78 : 1 }}
        transition={transicaoRotulo}
      >
        {rotulo}
        {obrigatorio && (
          <span aria-hidden="true" className="ml-1 align-super text-[0.7em] text-white/30">
            *
          </span>
        )}
      </motion.label>

      {multilinha ? (
        <textarea
          id={id}
          name={nome}
          value={valor}
          onChange={mudou}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          rows={3}
          required={obrigatorio}
          aria-invalid={!!erro}
          aria-describedby={erro ? idErro : dica ? idDica : undefined}
          className={cn(classesCampo, "min-h-[4.5rem] resize-none pb-2.5")}
        />
      ) : (
        <input
          id={id}
          name={nome}
          type={tipo === "tel" ? "tel" : tipo}
          inputMode={tipo === "tel" ? "numeric" : undefined}
          value={valor}
          onChange={mudou}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          autoComplete={autoComplete}
          required={obrigatorio}
          aria-invalid={!!erro}
          aria-describedby={erro ? idErro : dica ? idDica : undefined}
          className={cn(classesCampo, "pb-2.5")}
        />
      )}

      {/* Trilho e filete. `scaleX` com origem à esquerda, nunca largura: o
          filete não participa do layout e a animação fica na composição. */}
      <div
        className={cn(
          "relative h-px w-full transition-colors duration-300",
          erro ? "bg-white/25" : "bg-white/15",
        )}
      >
        <motion.span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 origin-left",
            erro ? "bg-white/70" : "bg-white",
          )}
          initial={false}
          animate={{ scaleX: focado || erro ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.45, ease: SAIDA }}
        />
      </div>

      <AnimatePresence initial={false} mode="wait">
        {erro ? (
          <motion.p
            key="erro"
            id={idErro}
            role="alert"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
            className="mt-2.5 [font-family:var(--font-fraunces)] text-sm italic text-white/70"
          >
            {erro}
          </motion.p>
        ) : (
          dica &&
          focado && (
            <motion.p
              key="dica"
              id={idDica}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0 : 0.25 }}
              className="mt-2.5 [font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-white/35"
            >
              {dica}
            </motion.p>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
