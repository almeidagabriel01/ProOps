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

export const coreRoutes = router;
