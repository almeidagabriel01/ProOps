import { Request, Response } from "express";
import { SharedTransactionService } from "../services/shared-transactions.service";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { db } from "../../init";

const VALID_EXPIRE_DAYS = [15, 30, 60, 90, 180, 365, null] as const;
type ValidExpireDays = (typeof VALID_EXPIRE_DAYS)[number];

function isValidExpireDays(value: unknown): value is ValidExpireDays {
  return (VALID_EXPIRE_DAYS as ReadonlyArray<unknown>).includes(value);
}

// Campos internos de infraestrutura que nunca devem ser expostos em rotas públicas.
const INTERNAL_TRANSACTION_FIELDS = new Set([
  "pdfPath",
  "pdfUrl",
  "storagePath",
  "pdfGenerationLock",
]);

/**
 * Remove campos internos sensíveis antes de responder em rotas públicas.
 * Evita enumeração de paths internos do Firebase Storage e metadados de lock.
 */
function sanitizeSharedTransactionPayload(
  id: string,
  data: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const safe: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(data || {})) {
    if (!INTERNAL_TRANSACTION_FIELDS.has(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

export const createShareLink = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id: transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ message: "ID do lancamento e obrigatorio" });
    }

    const rawExpireDays = Object.prototype.hasOwnProperty.call(req.body, "expireDays")
      ? req.body.expireDays
      : 30;

    if (!isValidExpireDays(rawExpireDays)) {
      return res.status(400).json({ message: "Prazo inválido" });
    }

    const expireDays: ValidExpireDays = rawExpireDays;

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);

    const transactionRef = db.collection("transactions").doc(transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return res.status(404).json({ message: "Lancamento nao encontrado" });
    }

    const transactionData = transactionSnap.data() as
      | { tenantId?: string }
      | undefined;
    const transactionTenantId = String(transactionData?.tenantId || "").trim();
    if (!transactionTenantId) {
      return res.status(412).json({ message: "Lancamento sem tenantId valido" });
    }

    if (!isSuperAdmin && transactionTenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const result = await SharedTransactionService.createShareLink(
      transactionId,
      transactionTenantId,
      userId,
      expireDays,
    );

    return res.status(201).json({
      success: true,
      ...result,
      message: "Link compartilhavel gerado com sucesso",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_EXPIRE_DAYS") {
      return res.status(400).json({ message: "Prazo inválido" });
    }
    console.error("Error creating shared transaction link:", error);
    const message = error instanceof Error ? error.message : "Erro ao gerar link";
    return res.status(500).json({ message });
  }
};

export const getShareLinkInfo = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id: transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ message: "ID do lancamento e obrigatorio" });
    }

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);

    const transactionRef = db.collection("transactions").doc(transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return res.status(404).json({ message: "Lancamento nao encontrado" });
    }

    const transactionData = transactionSnap.data() as
      | { tenantId?: string }
      | undefined;
    const transactionTenantId = String(transactionData?.tenantId || "").trim();
    if (!transactionTenantId) {
      return res.status(412).json({ message: "Lancamento sem tenantId valido" });
    }

    if (!isSuperAdmin && transactionTenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const result = await SharedTransactionService.getShareLinkInfo(
      transactionId,
      transactionTenantId,
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error getting share link info:", error);
    const message = error instanceof Error ? error.message : "Erro ao buscar informações do link";
    return res.status(500).json({ message });
  }
};

export const getSharedTransaction = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const isPdfGeneratorRequest = req.headers["x-pdf-generator"] === "true";

    if (!token) {
      return res.status(400).json({ message: "Token invalido" });
    }

    const sharedTransaction = await SharedTransactionService.getSharedTransaction(token);

    if (!sharedTransaction) {
      return res.status(404).json({ message: "Link nao encontrado ou invalido" });
    }

    const transactionRef = db.collection("transactions").doc(sharedTransaction.transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return res.status(404).json({ message: "Lancamento nao encontrado" });
    }

    const transactionData = transactionSnap.data() as
      | {
          tenantId?: string;
          proposalGroupId?: string;
          installmentGroupId?: string;
        }
      | undefined;

    const transactionTenantId = String(transactionData?.tenantId || "").trim();
    if (!transactionTenantId || transactionTenantId !== sharedTransaction.tenantId) {
      return res.status(404).json({ message: "Lancamento nao encontrado" });
    }

    let relatedTransactions: Array<Record<string, unknown>> = [];
    try {
      const tenantFilter = sharedTransaction.tenantId;
      const txData = transactionData as Record<string, unknown>;
      const anchorId = transactionSnap.id;
      const subQueries: Promise<Array<Record<string, unknown>>>[] = [];

      if (txData?.proposalGroupId) {
        subQueries.push(
          db.collection("transactions")
            .where("proposalGroupId", "==", txData.proposalGroupId)
            .where("tenantId", "==", tenantFilter)
            .get()
            .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        );
      }
      if (txData?.installmentGroupId) {
        subQueries.push(
          db.collection("transactions")
            .where("installmentGroupId", "==", txData.installmentGroupId)
            .where("tenantId", "==", tenantFilter)
            .get()
            .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        );
      }
      if (txData?.recurringGroupId) {
        subQueries.push(
          db.collection("transactions")
            .where("recurringGroupId", "==", txData.recurringGroupId)
            .where("tenantId", "==", tenantFilter)
            .get()
            .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        );
      }
      if (txData?.parentTransactionId) {
        const parentId = txData.parentTransactionId as string;
        subQueries.push(
          Promise.all([
            db.collection("transactions")
              .where("parentTransactionId", "==", parentId)
              .where("tenantId", "==", tenantFilter)
              .get()
              .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
            db.collection("transactions").doc(parentId).get().then((snap) => {
              if (snap.exists && (snap.data() as Record<string, unknown>)?.tenantId === tenantFilter) {
                return [{ id: snap.id, ...snap.data() }];
              }
              return [];
            }),
          ]).then(([siblings, parent]) => [...siblings, ...parent]),
        );
      }

      if (subQueries.length > 0) {
        const results = await Promise.all(subQueries);
        const seen = new Set<string>();
        for (const row of results.flat()) {
          const id = String(row.id || "");
          const rowTenantId = String((row as Record<string, unknown>).tenantId || "");
          if (id && id !== anchorId && !seen.has(id) && rowTenantId === tenantFilter) {
            seen.add(id);
            relatedTransactions.push(row);
          }
        }
      }
    } catch (relatedErr) {
      console.warn("[shared-transactions] Falha ao buscar relacionadas (nao critico):", relatedErr);
      relatedTransactions = [];
    }

    const tenantRef = db.collection("tenants").doc(sharedTransaction.tenantId);
    const tenantSnap = await tenantRef.get();
    const tenantData = tenantSnap.exists ? tenantSnap.data() : null;

    if (!isPdfGeneratorRequest) {
      const viewerData = {
        ip: req.ip || (req.headers["x-forwarded-for"] as string),
        userAgent: req.headers["user-agent"],
      };

      void SharedTransactionService.recordView(
        sharedTransaction.id,
        sharedTransaction.tenantId,
        sharedTransaction.transactionId,
        viewerData,
        (transactionData as Record<string, unknown>)?.description as
          | string
          | undefined,
      ).catch((recordError) => {
        console.error("recordView failed (non-critical)", recordError);
      });
    }

    // Lookup client info for boleto payment (name + hasDocument — never expose the document number)
    let clientPayload: { name: string | null; hasDocument: boolean } = { name: null, hasDocument: false };
    const rawClientId = (transactionData as Record<string, unknown>)?.clientId;
    const clientId = typeof rawClientId === "string" && rawClientId.trim().length > 0
      ? rawClientId.trim()
      : null;
    if (clientId) {
      const clientSnap = await db.collection("clients").doc(clientId).get();
      if (clientSnap.exists) {
        const clientData = clientSnap.data() as Record<string, unknown>;
        if (clientData.tenantId === sharedTransaction.tenantId) {
          const docRaw = typeof clientData.document === "string" ? clientData.document.replace(/\D/g, "") : "";
          clientPayload = {
            name: typeof clientData.name === "string" ? clientData.name : null,
            hasDocument: docRaw.length === 11 || docRaw.length === 14,
          };
        }
      }
    }

    return res.status(200).json({
      success: true,
      transaction: sanitizeSharedTransactionPayload(transactionSnap.id, transactionData),
      relatedTransactions: relatedTransactions.map((t) =>
        sanitizeSharedTransactionPayload(String(t.id || ""), t as Record<string, unknown>),
      ),
      tenant: tenantData
        ? {
            id: sharedTransaction.tenantId,
            name: tenantData.name,
            logoUrl: tenantData.logoUrl,
            primaryColor: tenantData.primaryColor,
            mercadoPagoEnabled: tenantData.mercadoPagoEnabled ?? false,
          }
        : null,
      client: clientPayload,
    });
  } catch (error) {
    console.error("Error getting shared transaction:", error);

    if (error instanceof Error && error.message === "EXPIRED_LINK") {
      return res.status(410).json({
        message: "Este link expirou. Solicite um novo link ao responsavel.",
        code: "EXPIRED_LINK",
      });
    }

    const message = error instanceof Error ? error.message : "Erro ao carregar lancamento";
    return res.status(500).json({ message });
  }
};
