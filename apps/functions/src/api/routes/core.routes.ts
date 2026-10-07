import { Router } from "express";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/products.controller";
import {
  createService,
  updateService,
  deleteService,
} from "../controllers/services.controller";
import {
  importClientsHandler,
  importProductsHandler,
  importServicesHandler,
} from "../controllers/import.controller";
import {
  createClient,
  updateClient,
  deleteClient,
} from "../controllers/clients.controller";
import {
  createProposal,
  updateProposal,
  deleteProposal,
} from "../controllers/proposals.controller";
import {
  getProposalNumbering,
  updateProposalNumbering,
} from "../controllers/proposal-numbering.controller";
import { downloadProposalPdf } from "../controllers/proposal-pdf.controller";
import { getProposalUsage } from "../controllers/proposal-usage.controller";
import {
  discardClientAcceptance,
  resolveClientChangeRequest,
} from "../controllers/proposal-online-approval.controller";
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";
import {
  createSpreadsheet,
  updateSpreadsheet,
  deleteSpreadsheet,
} from "../controllers/spreadsheets.controller";
import { createShareLink } from "../controllers/shared-proposals.controller";
import { updateTenant } from "../controllers/tenants.controller";

import { heartbeatSession, pingSession } from "../controllers/session.controller";

import {
  createClientNote,
  deleteClientNote,
  listClientNotes,
} from "../controllers/client-notes.controller";
const router = Router();

// A plataforma abriu autenticada (login ou sessao que ja existia): alimenta o
// "Ultima vez online" do painel do super admin.
router.post("/session/ping", pingSession);
router.post("/session/heartbeat", heartbeatSession);

// Products
router.post("/products", createProduct);
// Importação por planilha: antes das rotas /:id.
router.post("/products/import", importProductsHandler);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Services
router.post("/services", createService);
router.post("/services/import", importServicesHandler);
router.put("/services/:id", updateService);
router.delete("/services/:id", deleteService);

// Clients
router.post("/clients", createClient);
router.post("/clients/import", importClientsHandler);
router.put("/clients/:id", updateClient);
router.delete("/clients/:id", deleteClient);
router.get("/clients/:id/notes", listClientNotes);
router.post("/clients/:id/notes", createClientNote);
router.delete("/clients/:id/notes/:noteId", deleteClientNote);

// Proposals
// A numeracao vem ANTES de `/proposals/:id`: o Express casa por ordem, e
// `PUT /proposals/numbering` cairia no update de proposta com id "numbering".
router.get("/proposals/numbering", getProposalNumbering);
router.put("/proposals/numbering", updateProposalNumbering);
// "Este contato/produto/serviço está em alguma proposta?", antes de excluir.
router.get("/proposals/usage", getProposalUsage);
router.post("/proposals", createProposal);
router.put("/proposals/:id", updateProposal);
// Aceite do cliente pelo link: a empresa descarta para ajustar. Confirmar é
// mudar a proposta para aprovada, pelo PUT acima.
router.post("/proposals/:id/acceptance/discard", discardClientAcceptance);
router.post("/proposals/:id/change-request/resolve", resolveClientChangeRequest);
router.delete("/proposals/:id", deleteProposal);
router.get("/proposals/:id/pdf", pdfRateLimiter, downloadProposalPdf);
router.post("/spreadsheets", createSpreadsheet);
router.put("/spreadsheets/:id", updateSpreadsheet);
router.delete("/spreadsheets/:id", deleteSpreadsheet);
router.post("/proposals/:id/share-link", createShareLink);

// Tenants
router.put("/tenants/:id", updateTenant);

// Users (Self Profile)
import { updateProfile } from "../controllers/users.controller";
router.put("/profile", updateProfile);

export const coreRoutes = router;
