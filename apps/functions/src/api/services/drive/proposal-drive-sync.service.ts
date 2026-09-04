/**
 * Entrega automatica da proposta no Drive do tenant.
 *
 * **Quando dispara:** ao a proposta sair da fase de rascunho — status mapeado
 * para `sent` ou para aprovado. Nao a cada geracao do PDF, que era a leitura
 * literal de "assim que for gerada": o PDF e gerado SOB DEMANDA, toda vez que
 * alguem abre a proposta para conferir, e subir em cada uma encheria a pasta do
 * cliente de rascunho — destruindo a organizacao que a integracao promete.
 *
 * `sent` e o momento certo pelo caso de uso que originou o pedido: o vendedor
 * chega na casa do cliente com a documentacao e a proposta ja na pasta, pelo
 * celular, sem abrir o ERP. Esperar a aprovacao seria tarde demais.
 *
 * **Nunca lanca.** A mudanca de status ja aconteceu e a venda nao pode ser
 * desfeita porque o Google recusou um upload. Mesma regra do `tryAutoIssue` do
 * fiscal. Mas tambem **nunca dispara e esquece**: no Cloud Run a CPU so e
 * alocada enquanto a request e processada, entao uma promise pendente quando o
 * handler retorna vira trabalho perdido em silencio — nem o `.catch()` roda.
 */

import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { getOrGenerateProposalPdfBuffer } from "../proposal-pdf.service";
import { getDriveIntegration } from "./drive-oauth.service";
import { buildProposalFileName, uploadProposalPdf } from "./drive.service";

const PROPOSALS_COLLECTION = "proposals";

/**
 * Estas quatro colunas nascem com todo tenant (`getDefaultProposalColumns`) e
 * so ganham id quando gravadas; ate la o front usa `default_{indice}`.
 * A ordem e in_progress, sent, approved, rejected — por isso `default_1`.
 */
const SENT_STATUS_IDS = new Set(["sent", "default_1"]);

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * A proposta saiu do rascunho e ja pode ir para o cliente?
 *
 * Aceita tanto o valor canonico quanto a coluna de kanban que o tenant
 * renomeou — o que vale e o `mappedStatus`/`category` dela, nunca o rotulo
 * digitado, que varia por empresa.
 */
export async function isStatusDeliverableToDrive(
  statusId: string | undefined | null,
  tenantId: string,
): Promise<boolean> {
  const status = normalize(statusId);
  if (!status) return false;
  if (SENT_STATUS_IDS.has(status)) return true;
  if (status === "approved" || status === "default_2") return true;
  if (["draft", "in_progress", "rejected", "default_0", "default_3"].includes(status)) {
    return false;
  }

  try {
    const snapshot = await db
      .collection("kanban_statuses")
      .doc(String(statusId))
      .get();
    if (!snapshot.exists) return false;

    const data = snapshot.data() as {
      tenantId?: string;
      mappedStatus?: string | null;
      category?: string | null;
    };

    // Nunca inferir a partir de coluna de OUTRO tenant.
    const statusTenantId = String(data?.tenantId || "").trim();
    if (tenantId && statusTenantId && statusTenantId !== tenantId) {
      return false;
    }

    const mapped = normalize(data?.mappedStatus);
    if (mapped === "sent" || mapped === "approved") return true;
    return normalize(data?.category) === "won";
  } catch (error) {
    logger.warn("Falha ao classificar o status para o Drive", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Sobe a proposta para a pasta do cliente, se o tenant tiver o Drive ligado.
 *
 * Sai calado quando nao ha integracao ou pasta raiz: nao ter o Drive
 * configurado e o caso NORMAL — a maioria dos tenants nunca vai conectar, e
 * registrar isso como erro encheria o log de ruido.
 */
export async function syncProposalToDrive(params: {
  tenantId: string;
  proposalId: string;
  proposalData: Record<string, unknown>;
}): Promise<void> {
  try {
    const integration = await getDriveIntegration(params.tenantId);
    if (!integration?.rootFolderId) {
      return;
    }

    const clientId = String(params.proposalData.clientId || "").trim();
    if (!clientId) {
      // Proposta sem cliente nao tem pasta de destino. Nao e erro do Drive.
      logger.info("Proposta sem cliente — nada a enviar ao Drive", {
        tenantId: params.tenantId,
        proposalId: params.proposalId,
      });
      return;
    }

    const pdf = await getOrGenerateProposalPdfBuffer(
      params.tenantId,
      params.proposalId,
    );

    const result = await uploadProposalPdf({
      tenantId: params.tenantId,
      proposalId: params.proposalId,
      clientId,
      fileName: buildProposalFileName(
        params.proposalData.proposalNumber as string | number | undefined,
        String(params.proposalData.title || ""),
      ),
      pdf,
    });

    logger.info("Proposta entregue no Google Drive", {
      tenantId: params.tenantId,
      proposalId: params.proposalId,
      fileId: result.fileId,
    });
  } catch (error) {
    // Best-effort: o status ja mudou e a venda nao pode ser desfeita porque o
    // Google recusou um upload. Fica o registro para investigar.
    logger.error("Falha ao enviar a proposta para o Google Drive", {
      tenantId: params.tenantId,
      proposalId: params.proposalId,
      error: error instanceof Error ? error.message : String(error),
    });
    await db
      .collection(PROPOSALS_COLLECTION)
      .doc(params.proposalId)
      .update({
        driveSyncError:
          error instanceof Error ? error.message : String(error),
      })
      .catch(() => undefined);
  }
}
