import { FAQS, type FAQ } from "@/components/landing/_shared/faq-data";

/**
 * As dúvidas de quem está olhando funcionalidade por funcionalidade. Nenhuma
 * resposta cita plano pelo nome: o plano de cada uma já está na lista e na
 * página dela, derivado do catálogo, e uma resposta escrita à mão aqui
 * envelheceria na primeira mudança.
 */
const SEGMENTO = FAQS.find((f) => f.question.startsWith("A ProOps serve"));

export const FAQ_FUNCIONALIDADES: readonly FAQ[] = [
  {
    question: "Como sei o que vem no meu plano?",
    answer:
      "Cada funcionalidade da lista mostra o plano que a libera. Na página dela, cada parte aparece com o próprio plano e com o add-on que a destrava, quando existe.",
  },
  {
    question: "O meu cliente paga com cartão pelo link?",
    answer:
      "Não. Pelo link, o seu cliente paga com Pix ou boleto, pelo Asaas, com o pagamento online ativo. O cartão de crédito é só a forma de pagar a assinatura da ProOps.",
  },
  {
    question: "O cliente precisa criar conta para abrir os links?",
    answer:
      "Não. Proposta, parcela, obra, agendamento, portal e o acesso do contador abrem direto pelo link, sem senha. Você pode revogar o link do portal e trocar o do contador quando quiser.",
  },
  {
    question: "Posso ver um exemplo antes de assinar?",
    answer:
      "Pode. O portal do cliente e o acesso do contador têm páginas de exemplo abertas, nas páginas de Pós-venda por link e de Fluxo de caixa e DRE, e a conta gratuita navega o ERP inteiro com dados de demonstração do seu segmento, só para leitura.",
  },
  ...(SEGMENTO ? [SEGMENTO] : []),
  {
    question: "Dá para começar com menos e crescer depois?",
    answer:
      "Dá. Os add-ons somam por cima do plano quando você precisar deles, e a mudança de plano leva tudo o que já está cadastrado junto.",
  },
];
