import { describe, expect, it } from "vitest";
import {
  buildDeliveryMessage,
  buildChargeMessage,
  buildMailtoHref,
  buildProposalMessage,
  buildWhatsAppShareHref,
  toWhatsAppNumber,
} from "../send-link";

describe("toWhatsAppNumber", () => {
  it("põe o 55 no celular brasileiro com DDD", () => {
    expect(toWhatsAppNumber("(11) 99999-8888")).toBe("5511999998888");
    expect(toWhatsAppNumber("11 3333-4444")).toBe("551133334444");
  });

  it("mantém número que já tem DDI", () => {
    expect(toWhatsAppNumber("+55 11 99999-8888")).toBe("5511999998888");
  });

  it("número curto ou vazio vira nulo", () => {
    expect(toWhatsAppNumber("99999")).toBeNull();
    expect(toWhatsAppNumber(undefined)).toBeNull();
  });
});

describe("buildWhatsAppShareHref", () => {
  it("abre a conversa do cliente com a mensagem", () => {
    expect(buildWhatsAppShareHref("11999998888", "Olá & tchau")).toBe(
      "https://wa.me/5511999998888?text=Ol%C3%A1%20%26%20tchau",
    );
  });

  it("sem telefone deixa o usuário escolher o contato", () => {
    expect(buildWhatsAppShareHref("", "oi")).toBe("https://wa.me/?text=oi");
  });
});

describe("buildMailtoHref", () => {
  it("codifica destinatário, assunto e corpo", () => {
    expect(buildMailtoHref("ana@x.com", "Proposta: A&B", "linha 1\nlinha 2")).toBe(
      "mailto:ana%40x.com?subject=Proposta%3A%20A%26B&body=linha%201%0Alinha%202",
    );
  });
});

describe("mensagens", () => {
  it("proposta usa o primeiro nome, o título, a empresa e o link", () => {
    const { subject, message } = buildProposalMessage({
      clientName: "Maria Souza",
      proposalTitle: "Casa da Maria",
      companyName: "Casa Inteligente",
      url: "https://erp/share/abc",
    });
    expect(subject).toBe("Proposta: Casa da Maria | Casa Inteligente");
    expect(message).toContain("Olá, Maria!");
    expect(message).toContain("https://erp/share/abc");
    expect(message).not.toContain("—");
  });

  it("cobrança mostra valor e vencimento", () => {
    const { message } = buildChargeMessage({
      clientName: null,
      description: "Entrada",
      amount: 1500,
      dueDate: "2026-10-05",
      url: "https://erp/share/transaction/x",
    });
    expect(message).toContain("Olá!");
    expect(message).toMatch(/R\$\s?1\.500,00/);
    expect(message).toContain("05/10/2026");
  });
});

describe("buildDeliveryMessage", () => {
  it("chama pelo nome, cita a obra e leva o link, sem assinar pela empresa no corpo", () => {
    const { subject, message } = buildDeliveryMessage({
      clientName: "Maria Souza",
      projectTitle: "Casa da Maria",
      companyName: "Casa Inteligente",
      url: "https://erp/share/project/tok",
    });
    expect(subject).toBe("Entrega: Casa da Maria | Casa Inteligente");
    expect(message).toContain("Casa da Maria");
    expect(message).toContain("https://erp/share/project/tok");
    expect(message.split("\n\n")).toHaveLength(4);
    expect(message).not.toContain("—");
  });
});
