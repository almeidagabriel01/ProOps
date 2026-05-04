import { Router } from "express";
import {
  createAmbiente,
  updateAmbiente,
  deleteAmbiente,
  createSistema,
  updateSistema,
  deleteSistema,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  createOption,
  updateOption,
  deleteOption,
  createProposalTemplate,
  updateProposalTemplate,
  deleteProposalTemplate,
} from "../controllers/auxiliary.controller";

const router = Router();

// Ambientes
router.post("/ambientes", createAmbiente);
router.put("/ambientes/:id", updateAmbiente);
router.delete("/ambientes/:id", deleteAmbiente);

// Sistemas
router.post("/sistemas", createSistema);
router.put("/sistemas/:id", updateSistema);
router.delete("/sistemas/:id", deleteSistema);

// Custom Fields
router.post("/custom-fields", createCustomField);
router.put("/custom-fields/:id", updateCustomField);
router.delete("/custom-fields/:id", deleteCustomField);

// Options (Dropdowns etc)
router.post("/options", createOption);
router.put("/options/:id", updateOption);
router.delete("/options/:id", deleteOption);

// Proposal Templates
router.post("/proposal-templates", createProposalTemplate);
router.put("/proposal-templates/:id", updateProposalTemplate);
router.delete("/proposal-templates/:id", deleteProposalTemplate);

export const auxiliaryRoutes = router;
