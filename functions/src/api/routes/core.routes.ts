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
  createSpreadsheet,
  updateSpreadsheet,
  deleteSpreadsheet,
} from "../controllers/spreadsheets.controller";
import { createShareLink } from "../controllers/shared-proposals.controller";
import { updateTenant } from "../controllers/tenants.controller";

const router = Router();

// Products
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Services
router.post("/services", createService);
router.put("/services/:id", updateService);
router.delete("/services/:id", deleteService);

// Clients
router.post("/clients", createClient);
router.put("/clients/:id", updateClient);
router.delete("/clients/:id", deleteClient);

// Proposals
router.post("/proposals", createProposal);
router.put("/proposals/:id", updateProposal);
router.delete("/proposals/:id", deleteProposal);
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
