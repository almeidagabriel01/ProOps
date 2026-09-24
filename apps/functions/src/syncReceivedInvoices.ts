import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { logger } from "./lib/logger";
import { syncReceivedInvoices as syncTenant } from "./api/services/fiscal/received-invoice.service";
import { tenantHasCapability } from "./lib/tenant-capabilities";

/**
 * Busca as notas de entrada de cada tenant com recepcao habilitada.
 *
 * Roda de hora em hora: nota de entrada nao tem urgencia de segundos como a
 * autorizacao de uma emissao — o fornecedor emitiu, a Receita registrou, e o
 * destinatario tem dias para se manifestar. Consultar com mais frequencia so
 * gastaria chamada sem antecipar decisao nenhuma.
 *
 * A sincronizacao e incremental por versao, entao cada ciclo traz so o que
 * mudou desde o anterior — inclusive cancelamentos feitos pelo emitente.
 */
export const syncReceivedInvoices = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 1 hours",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    let tenants = 0;
    let applied = 0;
    let semPlano = 0;

    try {
      // So quem optou pela recepcao: a flag existe porque cada nota recebida
      // consome uma unidade do pacote mensal do provedor.
      const snap = await db
        .collection("fiscal_settings")
        .where("habilitaManifestacao", "==", true)
        .limit(500)
        .get();

      for (const doc of snap.docs) {
        const tenantId = (doc.data() as { tenantId?: string }).tenantId ?? doc.id;
        // Recepcao e so do Enterprise. Quem perdeu o plano com o flag ligado
        // para de ser sincronizado aqui, mas o provedor segue recebendo (e
        // cobrando) ate a recepcao ser desligada no cadastro da empresa, que
        // so muda com o certificado. O aviso existe para alguem desligar.
        if (!(await tenantHasCapability(tenantId, "fiscalReceiving"))) {
          semPlano += 1;
          logger.warn("fiscal_receiving_sem_plano", { tenantId });
          continue;
        }
        // syncTenant nao lanca — um tenant com problema nao pode travar os outros.
        const result = await syncTenant(tenantId);
        tenants += 1;
        applied += result.applied;
      }

      logger.info("Sincronizacao de notas de entrada concluida", {
        tenants,
        applied,
        semPlano,
      });
    } catch (error) {
      logger.error("Falha no cron de notas de entrada", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
