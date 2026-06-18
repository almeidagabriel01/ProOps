export type FAQ = { question: string; answer: string };

/**
 * Fonte única das perguntas da FAQ — consumida pelo componente client
 * `landing-faq.tsx` (UI) e pelo Server Component `page.tsx`, que renderiza o
 * `FAQPageJsonLd` para que as perguntas sejam indexáveis sem depender de JS.
 */
export const FAQS: FAQ[] = [
  {
    question: "Preciso de cartão de crédito para começar?",
    answer:
      "A assinatura da ProOps é cobrada apenas no cartão de crédito (em até 12x). Você escolhe o plano e conclui a assinatura direto no checkout seguro.",
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer:
      "A assinatura é paga por cartão de crédito (em até 12x). Já para receber dos seus clientes dentro da plataforma, a integração com o Asaas aceita Pix, boleto e cartão.",
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
