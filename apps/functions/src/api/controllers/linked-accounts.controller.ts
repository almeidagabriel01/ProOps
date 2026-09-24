import { Request, Response } from "express";
import { logger } from "../../lib/logger";
import { getLinkedAccounts } from "../services/linked-accounts.service";

// GET /v1/linked-accounts
// Qualquer usuario da empresa le o resumo; `canManage` em cada item diz quem
// pode conectar. O tenant vem SO de req.user, que no "Acessar Painel" do
// superadmin ja e o da empresa vista.
export async function getLinkedAccountsHandler(req: Request, res: Response) {
  const uid = req.user?.uid;
  const tenantId = req.user?.tenantId;
  if (!uid || !tenantId) {
    return res.status(403).json({ message: "Tenant não identificado." });
  }

  try {
    const accounts = await getLinkedAccounts(tenantId, uid, {
      role: req.user?.role || "",
      isSuperAdmin: req.user?.isSuperAdmin === true,
    });
    return res.json({ accounts });
  } catch (error) {
    logger.error("Falha ao montar as contas vinculadas", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ message: "Não foi possível carregar as contas vinculadas." });
  }
}
