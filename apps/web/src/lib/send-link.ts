import { formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";

/**
 * Envio de propostas e cobranças pelo WhatsApp e pelo e-mail DA EMPRESA: o
 * botão abre o aplicativo do próprio usuário com a mensagem pronta. A ProOps
 * não envia nada em nome da empresa (o número dela é único e sairia como
 * "ProOps", além de exigir modelo aprovado pela Meta).
 */

/** Telefone no formato do wa.me: só dígitos, com 55 quando é número brasileiro sem DDI. */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return null;
}

/** Sem telefone, o WhatsApp abre para o usuário escolher o contato. */
export function buildWhatsAppShareHref(
  phone: string | null | undefined,
  message: string,
): string {
  const number = toWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function buildMailtoHref(
  email: string | null | undefined,
  subject: string,
  body: string,
): string {
  const to = email ? encodeURIComponent(email.trim()) : "";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function firstName(name: string | null | undefined): string {
  return String(name ?? "").trim().split(/\s+/)[0] ?? "";
}

function greeting(clientName: string | null | undefined): string {
  const name = firstName(clientName);
  return name ? `Olá, ${name}!` : "Olá!";
}

export function buildProposalMessage(params: {
  clientName?: string | null;
  proposalTitle?: string | null;
  companyName?: string | null;
  url: string;
}): { subject: string; message: string } {
  const title = params.proposalTitle?.trim() || "sua proposta";
  const company = params.companyName?.trim();
  return {
    subject: company ? `Proposta: ${title} | ${company}` : `Proposta: ${title}`,
    message: [
      greeting(params.clientName),
      `Segue a proposta "${title}". Pelo link você vê todos os detalhes e baixa o PDF:`,
      params.url,
      "Qualquer dúvida, é só me chamar.",
    ].join("\n\n"),
  };
}

/** Link da entrega da obra: o cliente confere etapas e fotos e aceita. */
export function buildDeliveryMessage(params: {
  clientName?: string | null;
  projectTitle?: string | null;
  companyName?: string | null;
  url: string;
}): { subject: string; message: string } {
  const title = params.projectTitle?.trim() || "sua obra";
  const company = params.companyName?.trim();
  return {
    subject: company ? `Entrega: ${title} | ${company}` : `Entrega: ${title}`,
    message: [
      greeting(params.clientName),
      `A instalação de "${title}" está pronta. Pelo link você confere as etapas e as fotos e confirma a entrega:`,
      params.url,
      "Qualquer ajuste, é só me chamar.",
    ].join("\n\n"),
  };
}

export function buildChargeMessage(params: {
  clientName?: string | null;
  description?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  companyName?: string | null;
  url: string;
}): { subject: string; message: string } {
  const description = params.description?.trim() || "cobrança";
  const details = [
    typeof params.amount === "number" ? formatCurrency(params.amount) : null,
    params.dueDate ? `vencimento em ${formatDateBR(params.dueDate)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const company = params.companyName?.trim();
  return {
    subject: company ? `Cobrança: ${description} | ${company}` : `Cobrança: ${description}`,
    message: [
      greeting(params.clientName),
      `Segue o link de "${description}"${details ? ` (${details})` : ""}:`,
      params.url,
      "Qualquer dúvida, é só me chamar.",
    ].join("\n\n"),
  };
}
