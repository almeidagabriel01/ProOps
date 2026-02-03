import { Router } from "express";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/products.controller";
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
import { createShareLink } from "../controllers/shared-proposals.controller";
import { updateTenant } from "../controllers/tenants.controller";

const router = Router();

// Products
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Clients
router.post("/clients", createClient);
router.put("/clients/:id", updateClient);
router.delete("/clients/:id", deleteClient);

// Proposals
router.post("/proposals", createProposal);
router.put("/proposals/:id", updateProposal);
router.delete("/proposals/:id", deleteProposal);
router.post("/proposals/:id/share-link", createShareLink); // Nova rota para gerar link compartilhável

// Tenants
router.put("/tenants/:id", updateTenant);

export const coreRoutes = router;
