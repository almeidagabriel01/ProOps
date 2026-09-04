import { Router } from "express";
import {
  createRootFolderHandler,
  disconnectDriveHandler,
  getClientFolderHandler,
  getDriveAuthUrl,
  getDriveStatus,
  handleDriveCallback,
  setRootFolderHandler,
} from "../controllers/drive.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const protectedRouter = Router();
const publicRouter = Router();

// Gate POR PREFIXO, nunca `use()` sem path: todos os routers sao montados em
// `app.use("/v1", ...)`, entao um `use()` sem caminho aplicaria a capacidade a
// API inteira e falharia parecendo "o plano bloqueou", nao "montei errado".
protectedRouter.use("/drive", requirePlanCapability("driveSync"));

// Publico porque quem chama e o Google, sem token nosso. A protecao aqui e o
// `state` de uso unico com TTL, nao autenticacao.
publicRouter.get("/drive/google/callback", handleDriveCallback);

protectedRouter.get("/drive/google/auth-url", getDriveAuthUrl);
protectedRouter.get("/drive/google/status", getDriveStatus);
protectedRouter.delete("/drive/google/status", disconnectDriveHandler);
// POST cria a pasta (caminho padrao); PUT grava a que veio do Picker.
protectedRouter.post("/drive/google/root-folder", createRootFolderHandler);
protectedRouter.put("/drive/google/root-folder", setRootFolderHandler);

protectedRouter.get("/drive/clients/:clientId/folder", getClientFolderHandler);

export const driveRoutes = protectedRouter;
export const drivePublicRoutes = publicRouter;
