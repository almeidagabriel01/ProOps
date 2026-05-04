import { db } from "../init";
import { UserDoc } from "./auth-helpers";

export const LEGACY_LIMITS: Record<string, number> = {
  free: 10,
  starter: 120,
  pro: -1,
  enterprise: -1,
};

export const LEGACY_USER_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  pro: 2,
  enterprise: -1,
};

export const LEGACY_PROPOSAL_LIMITS: Record<string, number> = {
  free: 5,
  starter: 80,
  pro: -1,
  enterprise: -1,
};

export const checkClientLimit = async (masterData: UserDoc): Promise<void> => {
  let maxClientsVal = 10; // Default Free Limit
  const planId = masterData.planId || "free";

  if (LEGACY_LIMITS[planId] !== undefined) {
    maxClientsVal = LEGACY_LIMITS[planId];
  } else {
    // Check subscription object
    if (masterData.subscription?.limits?.maxClients !== undefined) {
      maxClientsVal = masterData.subscription.limits.maxClients;
    } else {
      // Fetch plan document
      const planSnap = await db.collection("plans").doc(planId).get();
      if (planSnap.exists) {
        maxClientsVal = planSnap.data()?.features?.maxClients ?? 10;
      }
    }
  }

  const maxClients = Number(maxClientsVal);
  const currentClients = Number(masterData.usage?.clients ?? 0);

  if (maxClients >= 0 && currentClients >= maxClients) {
    throw new Error(
      `Limite de clientes atingido (${currentClients}/${maxClients}). Faça upgrade do plano.`
    );
  }
};

export const checkUserLimit = async (
  masterData: UserDoc,
  masterId: string
): Promise<void> => {
  let maxUsersVal = 1; // Default
  const planId = masterData.planId || "free";

  if (LEGACY_USER_LIMITS[planId] !== undefined) {
    maxUsersVal = LEGACY_USER_LIMITS[planId];
  } else {
    if (masterData.subscription?.limits?.maxUsers !== undefined) {
      maxUsersVal = masterData.subscription.limits.maxUsers;
    } else {
      const planSnap = await db.collection("plans").doc(planId).get();
      if (planSnap.exists) {
        maxUsersVal = planSnap.data()?.features?.maxUsers ?? 1;
      }
    }
  }

  let currentUsers = Number(masterData.usage?.users ?? 0);

  // Fallback if usage is suspiciously low for a master with members
  if (currentUsers === 0) {
    const q = db.collection("users").where("masterId", "==", masterId);
    const snap = await q.count().get();
    currentUsers = snap.data().count + 1;
  }

  const maxUsers = Number(maxUsersVal);

  if (maxUsers >= 0 && currentUsers >= maxUsers) {
    throw new Error(
      `Limite de usuários atingido (${currentUsers}/${maxUsers}). Faça upgrade para adicionar mais membros.`
    );
  }
};

export const checkProposalLimit = async (
  masterData: UserDoc
): Promise<void> => {
  let maxProposalsVal = 5;
  const planId = masterData.planId || "free";

  if (LEGACY_PROPOSAL_LIMITS[planId] !== undefined) {
    maxProposalsVal = LEGACY_PROPOSAL_LIMITS[planId];
  } else {
    if (masterData.subscription?.limits?.maxProposals !== undefined) {
      maxProposalsVal = masterData.subscription.limits.maxProposals;
    } else {
      const planSnap = await db.collection("plans").doc(planId).get();
      if (planSnap.exists) {
        maxProposalsVal = planSnap.data()?.features?.maxProposals ?? 5;
      }
    }
  }

  const maxProposals = Number(maxProposalsVal);
  const currentProposals = Number(masterData.usage?.proposals ?? 0);

  if (maxProposals >= 0 && currentProposals >= maxProposals) {
    throw new Error(
      `Limite de propostas atingido (${currentProposals}/${maxProposals}). Faça upgrade do plano.`
    );
  }
};
