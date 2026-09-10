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
import { tenantHasCapability } from "../../../lib/tenant-capabilities";
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
/**
 * Desfecho da entrega.
 *
 * A funcao continua NAO lancando: o status da proposta ja mudou e a venda nao
 * pode ser desfeita porque o Google recusou um upload. Mas engolir o erro e
 * retornar `void` fazia a fila marcar como entregue o que tinha falhado — o
 * retry existia e nunca disparava, e o operador via "processed: 1" sobre uma
 * entrega que nao aconteceu. Quem chama precisa saber a diferenca entre
 * "entregue", "nao havia o que fazer" e "falhou".
 */
export type DriveDeliveryResult =
  | { status: "delivered"; fileId: string }
  | { status: "skipped"; reason: "sem_integracao" | "sem_cliente" }
  | { status: "failed"; error: string };

/**
 * Ha Drive conectado a ponto de valer enfileirar uma entrega?
 *
 * A condicao e a MESMA do `skipped: "sem_integracao"` logo abaixo, e as duas
 * precisam continuar iguais: se esta afrouxar, o job nasce para ser descartado
 * pelo cron; se apertar, uma entrega legitima deixa de ser enfileirada.
 *
 * Erro de leitura responde `true` de proposito. Entre criar um job que talvez
 * seja descartado e perder a entrega de uma proposta aprovada, o primeiro custa
 * um documento e o segundo custa a promessa da integracao.
 */
export async function isDriveConnected(tenantId: string): Promise<boolean> {
  try {
    const integration = await getDriveIntegration(tenantId);
    return Boolean(integration?.refreshTokenEnc && integration.rootFolderId);
  } catch (error) {
    logger.warn("Nao foi possivel checar a conexao com o Drive", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

/**
 * Vale sugerir que o usuario conecte o Drive?
 *
 * So para quem PODE conectar. Sem o gate de plano, todo tenant de um plano sem
 * a integracao levaria um convite a cada aprovacao de proposta, o que e upsell
 * no meio do trabalho, nao aviso util.
 */
export async function shouldSuggestDriveConnection(
  tenantId: string,
): Promise<boolean> {
  try {
    // A capacidade vem de cache em memoria; a integracao e leitura no
    // Firestore. Perguntar o plano primeiro evita a leitura para quem nem
    // poderia conectar.
    if (!(await tenantHasCapability(tenantId, "driveSync"))) return false;
    const integration = await getDriveIntegration(tenantId);
    return !integration?.refreshTokenEnc || !integration.rootFolderId;
  } catch {
    // Um aviso a menos nao quebra nada; uma excecao aqui derrubaria o
    // salvamento da proposta.
    return false;
  }
}

export async function syncProposalToDrive(params: {
  tenantId: string;
  proposalId: string;
  proposalData: Record<string, unknown>;
}): Promise<DriveDeliveryResult> {
  try {
    const integration = await getDriveIntegration(params.tenantId);
    // Sem token nao ha entrega — e o documento sobrevive ao desconectar para
    // preservar a pasta, entao checar so a pasta geraria um PDF a toa (o
    // recurso mais caro do backend) para falhar logo depois.
    if (!integration?.refreshTokenEnc || !integration.rootFolderId) {
      return { status: "skipped", reason: "sem_integracao" };
    }

    const clientId = String(params.proposalData.clientId || "").trim();
    if (!clientId) {
      // Proposta sem cliente nao tem pasta de destino. Nao e erro do Drive.
      logger.info("Proposta sem cliente — nada a enviar ao Drive", {
        tenantId: params.tenantId,
        proposalId: params.proposalId,
      });
      return { status: "skipped", reason: "sem_cliente" };
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
        params.proposalData.proposalCode as string | undefined,
        String(params.proposalData.title || ""),
      ),
      pdf,
    });

    logger.info("Proposta entregue no Google Drive", {
      tenantId: params.tenantId,
      proposalId: params.proposalId,
      fileId: result.fileId,
    });

    return { status: "delivered", fileId: result.fileId };
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

    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
