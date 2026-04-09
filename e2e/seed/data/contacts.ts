import type { Firestore } from "firebase-admin/firestore";

export interface SeedContact {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  type: "contact" | "supplier";
  createdAt: string;
  updatedAt: string;
}

const BASE_DATE = new Date("2024-01-01T00:00:00Z").toISOString();

// Matches the contactId / contactName values used in proposals seed data
export const CONTACT_ALPHA_001: SeedContact = {
  id: "contact-alpha-001",
  tenantId: "tenant-alpha",
  name: "João Silva",
  email: "joao.silva@example.com",
  phone: "(11) 91234-5678",
  type: "contact",
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

export const CONTACT_ALPHA_002: SeedContact = {
  id: "contact-alpha-002",
  tenantId: "tenant-alpha",
  name: "Maria Santos",
  email: "maria.santos@example.com",
  phone: "(11) 98765-4321",
  type: "contact",
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

export const CONTACT_ALPHA_003: SeedContact = {
  id: "contact-alpha-003",
  tenantId: "tenant-alpha",
  name: "Carlos Oliveira",
  email: "carlos.oliveira@example.com",
  phone: "(11) 97654-3210",
  type: "contact",
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

// Generic contact for CRUD test form interactions (name without accent for easy typing)
export const CONTACT_ALPHA_JOAO: SeedContact = {
  id: "contact-alpha-joao",
  tenantId: "tenant-alpha",
  name: "Joao Silva",
  email: "joao@example.com",
  phone: "(11) 99999-9999",
  type: "contact",
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

const ALL_CONTACTS: SeedContact[] = [
  CONTACT_ALPHA_001,
  CONTACT_ALPHA_002,
  CONTACT_ALPHA_003,
  CONTACT_ALPHA_JOAO,
];

export async function seedContacts(db: Firestore): Promise<void> {
  const batch = db.batch();

  for (const contact of ALL_CONTACTS) {
    batch.set(db.collection("clients").doc(contact.id), contact);
  }

  await batch.commit();
  console.log("[seed] Contacts (clients) created: 4 for tenant-alpha");
}
