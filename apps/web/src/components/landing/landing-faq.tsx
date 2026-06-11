"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Accent, SectionHeading } from "./_shared/section-heading";

type FAQ = { question: string; answer: string };

const FAQS: FAQ[] = [
  {
    question: "Preciso de cartão de crédito para começar?",
    answer:
      "Não. Você pode começar sem cartão e conhecer a plataforma antes de assinar. Quando decidir, escolhe o plano que faz sentido para a sua operação.",
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer:
      "Pix, boleto e cartão de crédito (em até 12x), processados por Stripe, MercadoPago e Asaas. Você escolhe a melhor opção no checkout.",
  },
  {
    question: "O sistema é compatível com a minha contabilidade?",
    answer:
      "Sim. Exportamos relatórios em formatos padrão da indústria, facilitando a integração com o software do seu contador sem retrabalho.",
  },
  {
    question: "Qual o limite de usuários?",
    answer:
      "Depende do plano escolhido. Planos superiores oferecem mais assentos, e você pode adicionar membros extras sob demanda direto pelo painel.",
  },
  {
    question: "Meus dados estão seguros? E quanto à LGPD?",
    answer:
      "Usamos criptografia em trânsito e em repouso, isolamento por empresa (multi-tenant) e tratamos dados pessoais conforme a LGPD, com exclusão sob demanda.",
  },
  {
    question: "Consigo migrar meus dados e cancelar quando quiser?",
    answer:
      "Sem lock-in. Você exporta seus dados quando precisar e pode cancelar a qualquer momento, sem fidelidade ou multa.",
  },
];

function AccordionItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: FAQ;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/60 backdrop-blur-sm transition-colors duration-300 hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-base font-semibold text-black dark:text-white md:text-lg">
          {faq.question}
        </span>
        <Plus
          className={`h-5 w-5 shrink-0 text-black/60 transition-transform duration-300 dark:text-white/60 ${
            isOpen ? "rotate-45" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 leading-relaxed text-black/65 dark:text-white/65">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * FAQ — acordeão theme-aware na linguagem mono premium, com perguntas que matam
 * objeções (cartão, pagamento, contabilidade, usuários, LGPD, cancelamento).
 * Expansão via CSS grid-rows (sem dependência de medição de altura).
 */
export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white px-6 py-28 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="Perguntas frequentes"
          title={
            <>
              Tudo que você precisa <Accent>saber</Accent>
            </>
          }
          description="Tire suas dúvidas antes de dar o próximo passo."
          className="mb-14"
        />

        <div className="space-y-3">
          {FAQS.map((faq, index) => (
            <AccordionItem
              key={faq.question}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() =>
                setOpenIndex((current) => (current === index ? null : index))
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
