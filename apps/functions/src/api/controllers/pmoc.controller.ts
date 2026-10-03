import { Request, Response } from "express";
import { logger } from "../../lib/logger";
import { hasPagePermission } from "../../lib/auth-helpers";
import { tenantHasCapability } from "../../lib/tenant-capabilities";
import { buildPdfContentDisposition, buildPdfFilename } from "../services/pdf-filename";
import { SERVICE_CONTRACTS_COLLECTION, todayInBrazil } from "../services/field-service/contract-model";
import { loadOfTenant } from "../services/field-service/field-service.service";
import {
  buildPmocShareUrl,
  buildPmocView,
  ensurePmocShareToken,
  generatePmocPdf,
  resolvePmocShareToken,
} from "../services/field-service/pmoc-document";
import { normalizeReportPeriod } from "../services/field-service/pmoc-report";

/**
 * O documento do PMOC: o link público (plano e relatório de execução) e o PDF
 * dos dois. Quem vê o contrato vê o PMOC (pageId `contracts`, ver).
 */

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function fail(res: Response, error: unknown, fallback: string, event: string) {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  logger.error(event, { error: error instanceof Error ? error.message : String(error) });
  return res.status(500).json({ message: fallback });
}

async function loadPmocContract(req: Request) {
  const tenantId = req.user?.tenantId;
  const uid = req.user?.uid;
  if (!tenantId || !uid) throw new HttpError(403, "Tenant não identificado.");
  if (!(await hasPagePermission(req.user, "contracts", "canView"))) {
    throw new HttpError(403, "Sem permissão para ver os contratos.");
  }
  const found = await loadOfTenant(SERVICE_CONTRACTS_COLLECTION, req.params.id, tenantId);
  if (!found) throw new HttpError(404, "Contrato não encontrado.");
  if (found.data.type !== "pmoc") throw new HttpError(400, "Este contrato não é um PMOC.");
  return { tenantId, uid, contractId: found.ref.id, code: String(found.data.code ?? "PMOC") };
}

/** POST /v1/service-contracts/:id/pmoc/share-link */
export async function createPmocShareLink(req: Request, res: Response) {
  try {
    const { tenantId, uid, contractId } = await loadPmocContract(req);
    const token = await ensurePmocShareToken({ tenantId, contractId, uid });
    return res.json({ url: buildPmocShareUrl(token) });
  } catch (error) {
    return fail(res, error, "Erro ao gerar o link do PMOC.", "pmoc_share_link_failed");
  }
}

/**
 * GET /v1/share/pmoc/:token (público). `from` e `to` escolhem o período do
 * relatório; sem eles, os últimos 12 meses. Token inexistente, contrato que
 * deixou de ser PMOC ou empresa sem o módulo dão o mesmo 404.
 */
export async function getSharedPmoc(req: Request, res: Response) {
  try {
    const shared = await resolvePmocShareToken(String(req.params.token || ""));
    if (!shared || !(await tenantHasCapability(shared.tenantId, "fieldService"))) {
      return res.status(404).json({ message: "Link não encontrado ou inválido" });
    }
    const view = await buildPmocView({
      tenantId: shared.tenantId,
      contract: shared.contract,
      from: req.query.from,
      to: req.query.to,
      today: todayInBrazil(),
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json(view);
  } catch (error) {
    return fail(res, error, "Erro ao carregar o PMOC.", "shared_pmoc_get_failed");
  }
}

/**
 * GET /v1/service-contracts/:id/pmoc/pdf?kind=plan|report&from=&to=
 *
 * Roda também na função `pdf` (o proxy manda todo caminho terminado em `/pdf`
 * para lá), que não passa pelo gate de plano do router: a capacidade é
 * conferida aqui.
 */
export async function downloadPmocPdf(req: Request, res: Response) {
  try {
    const { tenantId, uid, contractId, code } = await loadPmocContract(req);
    if (!(await tenantHasCapability(tenantId, "fieldService"))) {
      return res.status(402).json({ message: "O plano da empresa não inclui contratos." });
    }
    const kind = req.query.kind === "report" ? "report" : "plan";
    const period = normalizeReportPeriod(req.query.from, req.query.to, todayInBrazil());
    const buffer = await generatePmocPdf({ tenantId, contractId, uid, kind, period });
    const name = kind === "report" ? `Relatorio PMOC ${code}` : `Plano PMOC ${code}`;
    const filename = buildPdfFilename(name, { fallbackName: "PMOC.pdf" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildPdfContentDisposition(filename));
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(buffer);
  } catch (error) {
    return fail(res, error, "Erro ao gerar o PDF do PMOC.", "pmoc_pdf_failed");
  }
}
