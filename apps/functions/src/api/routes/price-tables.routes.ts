import { Router } from "express";
import {
  createPriceTableHandler,
  deletePriceTableHandler,
  getPriceTableHandler,
  listPriceTableOptionsHandler,
  listPriceTablesHandler,
  updatePriceTableHandler,
} from "../controllers/price-tables.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Por prefixo, nunca `router.use(gate)`: este router é montado em `/v1` junto
// dos demais, e um gate sem path fecharia a API inteira.
router.use("/price-tables", requirePlanCapability("priceTables"));

// Caminho fixo antes do parâmetro.
router.get("/price-tables/options", listPriceTableOptionsHandler);
router.get("/price-tables", listPriceTablesHandler);
router.post("/price-tables", createPriceTableHandler);
router.get("/price-tables/:id", getPriceTableHandler);
router.put("/price-tables/:id", updatePriceTableHandler);
router.delete("/price-tables/:id", deletePriceTableHandler);

export const priceTablesRoutes = router;
