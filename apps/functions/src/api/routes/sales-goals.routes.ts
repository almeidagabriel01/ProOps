import { Router } from "express";
import {
  getMyCommissions,
  getSalesGoals,
  getSalesGoalsProgress,
  listSellers,
  updateSalesGoals,
} from "../controllers/sales-goals.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Por prefixo, nunca `router.use(gate)`: este router é montado em `/v1` junto
// dos demais, e um gate sem path fecharia a API inteira.
router.use("/sales-goals", requirePlanCapability("salesGoals"));

// Caminhos fixos antes de qualquer parâmetro.
router.get("/sales-goals/progress", getSalesGoalsProgress);
router.get("/sales-goals/sellers", listSellers);
router.get("/sales-goals/my-commissions", getMyCommissions);
router.get("/sales-goals", getSalesGoals);
router.put("/sales-goals", updateSalesGoals);

export const salesGoalsRoutes = router;
