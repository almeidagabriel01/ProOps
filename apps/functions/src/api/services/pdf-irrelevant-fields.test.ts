/**
 * Quais campos da proposta NAO mudam o PDF.
 *
 * A lista decide duas coisas ao mesmo tempo:
 *
 * 1. **O hash de versao do PDF.** Campo irrelevante dentro do hash invalida o
 *    cache a toa e reabre o Chromium. `status` fazia isso em toda mudanca de
 *    coluna do kanban, e `driveFileId`/`driveSyncError` sao piores: a PROPRIA
 *    entrega no Drive os escreve na proposta, entao o PDF recem-gerado
 *    invalidava o proprio cache.
 * 2. **Se vale reentregar no Google Drive.** Salvar uma proposta ja aprovada
 *    mexendo so nesses campos nao muda um byte do arquivo; reenviar seria
 *    pagar um render e um upload para produzir o mesmo PDF.
 *
 * Um campo VISIVEL no PDF que entre aqui por engano e pior que o inverso: o
 * cliente passaria a receber um documento desatualizado, em silencio.
 */

import { PDF_IRRELEVANT_PROPOSAL_FIELDS } from "./proposal-pdf.service";

/** Campos que o template do PDF renderiza. Nenhum pode estar na lista. */
const CAMPOS_QUE_APARECEM_NO_PDF = [
  "title",
  "clientName",
  "clientEmail",
  "clientPhone",
  "clientAddress",
  "validUntil",
  "products",
  "sistemas",
  "sections",
  "discount",
  "totalValue",
  "closedValue",
  "extraExpense",
  "customNotes",
  "notes",
  "attachments",
  "pdfSettings",
  "downPaymentEnabled",
  "downPaymentType",
  "downPaymentPercentage",
  "downPaymentValue",
  "downPaymentDueDate",
  "downPaymentMethod",
  "installmentsEnabled",
  "installmentsCount",
  "installmentValue",
  "firstInstallmentDate",
  "installmentsPaymentMethod",
  "paymentMethod",
];

describe("PDF_IRRELEVANT_PROPOSAL_FIELDS", () => {
  it.each(CAMPOS_QUE_APARECEM_NO_PDF)(
    "%s NAO pode ser tratado como irrelevante",
    (campo) => {
      expect(PDF_IRRELEVANT_PROPOSAL_FIELDS.has(campo)).toBe(false);
    },
  );

  it.each([
    "status",
    "driveFileId",
    "driveSyncError",
    "searchTokens",
    "primarySystem",
    "primaryEnvironment",
    "commissions",
    "pdf",
    "pdfGenerationLock",
    "createdAt",
    "updatedAt",
  ])("%s e irrelevante para o PDF", (campo) => {
    expect(PDF_IRRELEVANT_PROPOSAL_FIELDS.has(campo)).toBe(true);
  });

  // As comissões são informação interna e não entram no documento; se um dia
  // alguém as colocar no PDF, este teste tem que cair junto com o guard
  // `apps/web/src/__tests__/commissions-not-in-pdf.test.ts`.
  it("comissao continua fora do documento", () => {
    expect(PDF_IRRELEVANT_PROPOSAL_FIELDS.has("commissions")).toBe(true);
  });
});
