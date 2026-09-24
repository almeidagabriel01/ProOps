import { db } from "../init";
import { UserDoc } from "./auth-helpers";
import { PLAN_CATALOG } from "../shared/plan-capabilities";

// Estas tres tabelas continuam existindo com o nome "LEGACY" porque leem do
// doc do USUARIO (abordagem antiga), enquanto tenant-plan-policy le do doc do
// TENANT. O que mudou: os NUMEROS nao sao mais digitados aqui — saem do
// catalogo. Enquanto eram literais, `free.maxProposals` valia 5 aqui e 15 no
// admin.controller, e ninguem sabia qual era o certo.
export const LEGACY_LIMITS: Record<string, number> = {
  free: PLAN_CATALOG.free.limits.maxClients,
  starter: PLAN_CATALOG.starter.limits.maxClients,
  pro: PLAN_CATALOG.pro.limits.maxClients,
  enterprise: PLAN_CATALOG.enterprise.limits.maxClients,
};

export const LEGACY_USER_LIMITS: Record<string, number> = {
  free: PLAN_CATALOG.free.limits.maxUsers,
  starter: PLAN_CATALOG.starter.limits.maxUsers,
  pro: PLAN_CATALOG.pro.limits.maxUsers,
  enterprise: PLAN_CATALOG.enterprise.limits.maxUsers,
};

export const LEGACY_PROPOSAL_LIMITS: Record<string, number> = {
  free: PLAN_CATALOG.free.limits.maxProposalsPerMonth,
  starter: PLAN_CATALOG.starter.limits.maxProposalsPerMonth,
  pro: PLAN_CATALOG.pro.limits.maxProposalsPerMonth,
  enterprise: PLAN_CATALOG.enterprise.limits.maxProposalsPerMonth,
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
