import type { Firestore } from "firebase-admin/firestore";

export interface SeedProposal {
  id: string;
  tenantId: string;
  title: string;
  status: "draft" | "in_progress" | "sent" | "approved" | "rejected";
  contactId: string;
  contactName: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  total: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const BASE_DATE = new Date("2024-06-01T00:00:00Z");

export const PROPOSAL_ALPHA_DRAFT: SeedProposal = {
  id: "proposal-alpha-draft",
  tenantId: "tenant-alpha",
  title: "Automação Residencial - Casa Verde",
  status: "draft",
  contactId: "contact-alpha-001",
  contactName: "João Silva",
  items: [
    {
      productId: "product-001",
      productName: "Central de Automação X200",
      quantity: 1,
      unitPrice: 2500.0,
      total: 2500.0,
    },
    {
      productId: "product-002",
      productName: "Sensor de Presença",
      quantity: 4,
      unitPrice: 150.0,
      total: 600.0,
    },
  ],
  total: 3100.0,
  createdAt: BASE_DATE.toISOString(),
  updatedAt: BASE_DATE.toISOString(),
  createdBy: "user-admin-alpha",
};

export const PROPOSAL_ALPHA_SENT: SeedProposal = {
  id: "proposal-alpha-sent",
  tenantId: "tenant-alpha",
  title: "Sistema Inteligente - Condomínio Alfa",
  status: "sent",
  contactId: "contact-alpha-002",
  contactName: "Maria Santos",
  items: [
    {
      productId: "product-003",
      productName: "Hub IoT Pro",
      quantity: 2,
      unitPrice: 1800.0,
      total: 3600.0,
    },
  ],
  total: 3600.0,
  createdAt: new Date("2024-06-05T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-06-06T00:00:00Z").toISOString(),
  createdBy: "user-admin-alpha",
};

export const PROPOSAL_ALPHA_APPROVED: SeedProposal = {
  id: "proposal-alpha-approved",
  tenantId: "tenant-alpha",
  title: "Retrofit Automatizado - Escritório Central",
  status: "approved",
  contactId: "contact-alpha-003",
  contactName: "Carlos Oliveira",
  items: [
    {
      productId: "product-001",
      productName: "Central de Automação X200",
      quantity: 3,
      unitPrice: 2500.0,
      total: 7500.0,
    },
    {
      productId: "product-004",
      productName: "Tomada Inteligente",
      quantity: 10,
      unitPrice: 80.0,
      total: 800.0,
    },
  ],
  total: 8300.0,
  createdAt: new Date("2024-05-20T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-05-28T00:00:00Z").toISOString(),
  createdBy: "user-admin-alpha",
};

export const PROPOSAL_BETA_DRAFT: SeedProposal = {
  id: "proposal-beta-draft",
  tenantId: "tenant-beta",
  title: "Cortinas Motorizadas - Sala de Estar",
  status: "draft",
  contactId: "contact-beta-001",
  contactName: "Ana Pereira",
  items: [
    {
      productId: "product-curtain-001",
      productName: "Motor para Cortina Blackout",
      quantity: 3,
      unitPrice: 420.0,
      total: 1260.0,
    },
  ],
  total: 1260.0,
  createdAt: BASE_DATE.toISOString(),
  updatedAt: BASE_DATE.toISOString(),
  createdBy: "user-admin-beta",
};

const ALL_PROPOSALS: SeedProposal[] = [
  PROPOSAL_ALPHA_DRAFT,
  PROPOSAL_ALPHA_SENT,
  PROPOSAL_ALPHA_APPROVED,
  PROPOSAL_BETA_DRAFT,
];

export async function seedProposals(db: Firestore): Promise<void> {
  const batch = db.batch();

  for (const proposal of ALL_PROPOSALS) {
    batch.set(db.collection("proposals").doc(proposal.id), proposal);
  }

  await batch.commit();
  console.log("[seed] Proposals created: 3 for tenant-alpha (draft/sent/approved), 1 for tenant-beta");
}
