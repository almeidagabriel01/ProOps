"use client";

import React, { useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { AnimatePresence, m as motion, useReducedMotion } from "motion/react";
import { Accent, SectionHeading } from "./_shared/section-heading";
import { LandingButton } from "./_shared/landing-button";
import { FAQS } from "./_shared/faq-data";

/**
 * FAQ — paleta de comandos (estilo Raycast/Linear): um campo de busca filtra as
 * perguntas em tempo real, navegáveis por teclado (↑↓/↵), e a resposta abre inline
 * sob a pergunta selecionada. Realce ativo desliza entre os itens (layoutId). Mono,
 * com guarda de prefers-reduced-motion.
 */
export function LandingFAQ() {
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [openQuestion, setOpenQuestion] = useState<string | null>(
    FAQS[0].question,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter((f) => f.question.toLowerCase().includes(q));
  }, [query]);

  const active = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  const toggle = (question: string) =>
    setOpenQuestion((cur) => (cur === question ? null : question));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const f = filtered[active];
      if (f) toggle(f.question);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <section
      id="faq"
      className="border-t border-black/10 bg-white px-6 py-28 dark:border-white/10 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-2xl">
        <SectionHeading
          eyebrow="Perguntas frequentes"
          title={
            <>
              Tudo que você precisa <Accent>saber</Accent>
            </>
          }
          description="Busque ou navegue pelas dúvidas mais comuns."
          className="mb-12"
        />

        {/* paleta */}
        <div
          className="overflow-hidden rounded-2xl border border-black/10 bg-white/80 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/70 dark:shadow-[0_40px_100px_-50px_rgba(0,0,0,0.8)]"
          onClick={() => inputRef.current?.focus()}
        >
          {/* campo de busca */}
          <div className="flex items-center gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10">
            <Search className="h-4 w-4 shrink-0 text-black/40 dark:text-white/40" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo sobre a ProOps…"
              className="w-full bg-transparent text-sm text-black outline-none placeholder:text-black/40 dark:text-white dark:placeholder:text-white/40 md:text-base"
            />
            <kbd className="hidden shrink-0 rounded-md border border-black/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-black/45 dark:border-white/15 dark:text-white/45 sm:block">
              {query ? "esc" : "/"}
            </kbd>
          </div>

          {/* lista de perguntas */}
          <div className="max-h-[28rem] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
                <p className="text-sm text-black/45 dark:text-white/45">
                  Nenhuma resposta para “{query}”. Fale direto com a gente.
                </p>
                <LandingButton href="/contato" variant="solid" size="sm">
                  Entre em contato
                </LandingButton>
              </div>
            ) : (
              filtered.map((faq, idx) => {
                const isActive = idx === active;
                const isOpen = openQuestion === faq.question;
                return (
                  <div key={faq.question} className="relative">
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        setActiveIndex(idx);
                        toggle(faq.question);
                      }}
                      aria-expanded={isOpen}
                      className="relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left"
                    >
                      {isActive && (
                        <motion.span
                          layoutId="faq-active"
                          aria-hidden
                          className="absolute inset-0 -z-0 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]"
                          transition={{
                            type: reduce ? "tween" : "spring",
                            duration: reduce ? 0 : undefined,
                            stiffness: 380,
                            damping: 32,
                          }}
                        />
                      )}
                      <span
                        aria-hidden
                        className={`relative z-10 h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200 ${
                          isOpen
                            ? "bg-black dark:bg-white"
                            : "bg-black/25 dark:bg-white/25"
                        }`}
                      />
                      <span
                        className={`relative z-10 flex-1 text-sm font-medium transition-colors duration-200 md:text-[0.95rem] ${
                          isActive || isOpen
                            ? "text-black dark:text-white"
                            : "text-black/70 dark:text-white/70"
                        }`}
                      >
                        {faq.question}
                      </span>
                      <CornerDownLeft
                        aria-hidden
                        className={`relative z-10 h-3.5 w-3.5 shrink-0 text-black/40 transition-opacity duration-200 dark:text-white/40 ${
                          isActive ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="answer"
                          initial={
                            reduce ? { height: "auto" } : { height: 0, opacity: 0 }
                          }
                          animate={{ height: "auto", opacity: 1 }}
                          exit={reduce ? { height: 0 } : { height: 0, opacity: 0 }}
                          transition={{
                            duration: reduce ? 0 : 0.38,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="overflow-hidden"
                        >
                          <p className="px-4 pb-4 pl-9 pr-6 text-sm leading-relaxed text-black/60 dark:text-white/65">
                            {faq.answer}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>

          {/* rodapé com dicas */}
          <div className="flex items-center gap-4 border-t border-black/10 px-5 py-2.5 text-[0.7rem] text-black/40 dark:border-white/10 dark:text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-black/15 px-1 dark:border-white/15">
                ↑↓
              </kbd>
              navegar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-black/15 px-1 dark:border-white/15">
                ↵
              </kbd>
              abrir
            </span>
            <span className="ml-auto">
              <LandingButton
                href="/contato"
                variant="link"
                tone="muted"
                className="text-[0.72rem]"
              >
                Não achou? Fale com a gente
              </LandingButton>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
