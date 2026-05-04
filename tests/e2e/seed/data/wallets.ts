import type { Firestore } from "firebase-admin/firestore";

export interface SeedWallet {
  id: string;
  tenantId: string;
  name: string;
  type: "bank" | "cash" | "digital" | "credit_card" | "other";
  balance: number;
  color: string;
  isDefault?: boolean;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export const WALLET_ALPHA_MAIN: SeedWallet = {
  id: "wallet-alpha-main",
  tenantId: "tenant-alpha",
  name: "Conta Principal",
  type: "bank",
  balance: 15000.0,
  color: "#2563EB",
  isDefault: true,
  status: "active",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

export const WALLET_ALPHA_SAVINGS: SeedWallet = {
  id: "wallet-alpha-savings",
  tenantId: "tenant-alpha",
  name: "Reserva",
  type: "bank",
  balance: 8500.0,
  color: "#16A34A",
  isDefault: false,
  status: "active",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

export const WALLET_BETA_MAIN: SeedWallet = {
  id: "wallet-beta-main",
  tenantId: "tenant-beta",
  name: "Caixa Beta",
  type: "cash",
  balance: 3200.0,
  color: "#DC2626",
  isDefault: true,
  status: "active",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

const ALL_WALLETS: SeedWallet[] = [
  WALLET_ALPHA_MAIN,
  WALLET_ALPHA_SAVINGS,
  WALLET_BETA_MAIN,
];

export async function seedWallets(db: Firestore): Promise<void> {
  const batch = db.batch();

  for (const wallet of ALL_WALLETS) {
    batch.set(db.collection("wallets").doc(wallet.id), wallet);
  }

  await batch.commit();
  console.log("[seed] Wallets created: 2 for tenant-alpha, 1 for tenant-beta");
}
