import {
  CalendarClock,
  Calculator,
  FileSignature,
  HardHat,
  LayoutDashboard,
  QrCode,
} from "lucide-react";

import type { Recurso } from "../tipos";

/**
 * O que a empresa manda ao cliente final e ao contador: páginas públicas,
 * abertas por link, sem senha. É a área que nenhuma planilha substitui, e a
 * que a landing antiga não mencionava.
 */
export const RECURSOS_DE_POS_VENDA: readonly Recurso[] = [
  {
    id: "link-da-proposta",
    categoria: "links",
    titulo: "Link da proposta",
    resumo: "A proposta com a sua marca, para ver no celular e baixar o PDF.",
    detalhes: [
      "Nos planos com aceite online, o cliente aceita ou pede mudanças ali mesmo.",
      "Com o pagamento online, a entrada já pode ser paga no mesmo link.",
    ],
    icone: FileSignature,
    requisito: { tipo: "livre" },
    rota: "/proposals",
    ondeFica: "Propostas › Compartilhar",
  },
  {
    id: "link-do-recibo",
    categoria: "links",
    titulo: "Recibo e cobrança por link",
    resumo: "Cada parcela tem um link com o recibo e as outras parcelas da mesma venda.",
    detalhes: ["O cliente baixa o recibo em PDF.", "A mesma página vira cobrança com o pagamento online."],
    icone: QrCode,
    requisito: { tipo: "plano", recursos: ["hasFinancial"] },
    rota: "/transactions",
    ondeFica: "Lançamentos › Compartilhar",
  },
  {
    id: "pagamento-online",
    categoria: "links",
    titulo: "Pagamento por Pix e boleto",
    resumo: "O cliente paga a parcela no link, e a baixa entra sozinha no financeiro.",
    detalhes: [
      "Pix com QR code e código para copiar, ou boleto com linha digitável.",
      "Cobrança pelo Asaas, com o repasse para a conta da empresa.",
      "Você é avisado quando o pagamento cai.",
    ],
    icone: QrCode,
    requisito: { tipo: "plano", recursos: ["hasFinancial", "hasOnlinePayments"] },
    rota: "/transactions",
    ondeFica: "Configurações › Pagamentos",
  },
  {
    id: "link-da-obra",
    categoria: "links",
    titulo: "Acompanhamento da obra",
    resumo: "O cliente vê as etapas, o checklist, as fotos e a próxima visita.",
    detalhes: ["As anotações internas da equipe ficam de fora.", "No fim, o cliente aceita a entrega pelo mesmo link."],
    icone: HardHat,
    requisito: { tipo: "plano", recursos: ["hasProjects"] },
    rota: "/projects",
    ondeFica: "Obras › Link da entrega",
  },
  {
    id: "link-de-agendamento",
    categoria: "links",
    titulo: "Link de agendamento",
    resumo: "O cliente escolhe o tipo de visita e um horário livre da sua agenda.",
    detalhes: [
      "Dias, horários, antecedência mínima e folgas definidos por você.",
      "O pedido chega na Agenda para confirmar, e o cliente recebe o e-mail da resposta.",
    ],
    icone: CalendarClock,
    requisito: { tipo: "plano", recursos: ["hasBookingLink"] },
    rota: "/settings/booking",
    ondeFica: "Configurações › Agendamento",
  },
  {
    id: "portal-do-cliente",
    categoria: "links",
    titulo: "Portal do cliente",
    resumo: "Um link fixo por cliente com propostas, pagamentos, obras e notas.",
    detalhes: [
      "Cada item abre o próprio link: aceitar, pagar, acompanhar.",
      "Você revoga o link quando quiser.",
    ],
    icone: LayoutDashboard,
    requisito: { tipo: "plano", recursos: ["hasClientPortal"] },
    rota: "/contacts",
    ondeFica: "Contatos › Portal do cliente",
    exemplo: { rotulo: "Abrir o portal de exemplo", href: "/share/portal/exemplo" },
  },
  {
    id: "link-do-contador",
    categoria: "links",
    titulo: "Link do contador",
    resumo: "O contador abre o DRE, os lançamentos e as notas, sem login e sem ocupar usuário.",
    detalhes: [
      "Período de até 12 meses, regime de caixa ou de competência.",
      "Notas em PDF e XML, e tudo exportável para Excel ou CSV.",
      "Só o dono e os administradores geram e trocam o link.",
    ],
    icone: Calculator,
    requisito: { tipo: "plano", recursos: ["hasFinancial"] },
    rota: "/dre",
    ondeFica: "DRE › Link do contador",
    exemplo: { rotulo: "Abrir o acesso de exemplo", href: "/share/contador/exemplo" },
  },
];
