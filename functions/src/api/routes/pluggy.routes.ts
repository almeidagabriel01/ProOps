
import { Router } from "express";
import { PluggyService } from "../services/pluggy.service";

const router = Router();

// POST /v1/pluggy/connect-token
// Creates a token to initialize the Pluggy Widget
router.post("/connect-token", async (req, res) => {
  try {
    const { itemId } = req.body; // Optional: itemId to update an existing connection
    const token = await PluggyService.createConnectToken(itemId);
    res.json({ accessToken: token });
  } catch (error) {
    console.error("Error creating connect token:", error);
    res.status(500).json({ error: "Failed to create connect token" });
  }
});

router.get("/health", (req, res) => {
  res.json({ status: "Pluggy routes working" });
});

// GET /v1/pluggy/products (Mock example, replace with real data if needed)
router.get("/products", async (req, res) => {
    res.json(["ACCOUNT", "IDENTITY", "TRANSACTIONS"]);
});


export const pluggyRoutes = router;
