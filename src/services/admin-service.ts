import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  getCountFromServer,
  updateDoc,
} from "firebase/firestore";
import { Tenant, User, AddonType, PlanFeatures, UserPlan } from "@/types";
import { PlanService } from "./plan-service";

export interface TenantBillingInfo {
  tenant: Tenant;
  admin: User;
  planId: string;
  planName: string;
  planFeatures?: PlanFeatures;
  billingInterval: "monthly" | "yearly";
  subscriptionStatus:
    | "active"
    | "inactive"
    | "trial"
    | "past_due"
    | "free"
    | "canceled"
    | "unpaid"
    | "trialing";
  amount: number;
  addOns: AddonType[];
  nextBillingDate?: Date;
  usage: {
    users: number;
    products: number;
    clients: number;
    proposals: number;
  };
}

export const AdminService = {
  async updateTenantLimits(
    tenantId: string,
    customFeatures: Partial<PlanFeatures>
  ) {
    try {
      const ref = doc(db, "tenants", tenantId);
      await updateDoc(ref, {
        customFeatures: customFeatures,
      });
      return true;
    } catch (error) {
      console.error("Error updating tenant limits:", error);
      throw error;
    }
  },

  async updateUserPlan(userId: string, planId: string) {
    try {
      const ref = doc(db, "users", userId);
      await updateDoc(ref, { planId });
      return true;
    } catch (error) {
      console.error("Error updating user plan:", error);
      throw error;
    }
  },

  async updateUserSubscription(
    userId: string,
    data: {
      subscriptionStatus?:
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "trialing";
      currentPeriodEnd?: string;
      isManualSubscription?: boolean;
    }
  ) {
    try {
      const ref = doc(db, "users", userId);
      const nestedStatus = data.subscriptionStatus?.toUpperCase() || "ACTIVE";
      const { deleteField } = await import("firebase/firestore");

      await updateDoc(ref, {

        "subscription.status": nestedStatus,
        "subscription.updatedAt": new Date(),

        subscriptionStatus: deleteField(),
      });
      return true;
    } catch (error) {
      console.error("Error updating user subscription:", error);
      throw error;
    }
  },

  async updateAdminCredentials(
    userId: string,
    tenantId: string,
    email?: string,
    password?: string
  ) {
    const { getFunctions, httpsCallable } = await import("firebase/functions");
    const functions = getFunctions(undefined, "southamerica-east1");
    const updateCredentialsFn = httpsCallable(
      functions,
      "updateAdminCredentials"
    );

    try {
      await updateCredentialsFn({ userId, tenantId, email, password });
      return true;
    } catch (error) {
      console.error("Error updating admin credentials:", error);
      throw error;
    }
  },

  async getAllTenantsBilling(): Promise<TenantBillingInfo[]> {
    try {
      const tenantsSnap = await getDocs(collection(db, "tenants"));
      const tenants = tenantsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Tenant
      );

      const plans = await PlanService.getPlans();
      const planMap = new Map(plans.map((p) => [p.id, p]));
      plans.forEach((p) => {
        if (p.tier) planMap.set(p.tier, p);
      });

      const billingInfos = await Promise.all(
        tenants.map(async (tenant): Promise<TenantBillingInfo | null> => {
          try {
            const q = query(
              collection(db, "users"),
              where("tenantId", "==", tenant.id),
              where("role", "==", "admin")
            );
            const snapshot = await getDocs(q);

            let admin = snapshot.empty
              ? null
              : ({
                  id: snapshot.docs[0].id,
                  ...snapshot.docs[0].data(),
                } as User);

            if (!admin) {
              const qAny = query(
                collection(db, "users"),
                where("tenantId", "==", tenant.id)
              );
              const snapAny = await getDocs(qAny);
              if (!snapAny.empty) {
                const payer = snapAny.docs.find(
                  (d) => d.data().stripeSubscriptionId
                );
                admin = payer
                  ? ({ id: payer.id, ...payer.data() } as User)
                  : ({
                      id: snapAny.docs[0].id,
                      ...snapAny.docs[0].data(),
                    } as User);
              }
            }

            if (!admin) return null;

            const addonsQ = query(
              collection(db, "purchased_addons"),
              where("tenantId", "==", tenant.id),
              where("status", "==", "active")
            );
            const addonsSnap = await getDocs(addonsQ);
            const addOns = addonsSnap.docs.map(
              (d) => d.data().addonType as AddonType
            );

            const [usersCount, productsCount, clientsCount, proposalsCount] =
              await Promise.all([
                getCountFromServer(
                  query(
                    collection(db, "users"),
                    where("tenantId", "==", tenant.id)
                  )
                ),
                getCountFromServer(
                  query(
                    collection(db, "products"),
                    where("tenantId", "==", tenant.id)
                  )
                ),
                getCountFromServer(
                  query(
                    collection(db, "clients"),
                    where("tenantId", "==", tenant.id)
                  )
                ),
                getCountFromServer(
                  query(
                    collection(db, "proposals"),
                    where("tenantId", "==", tenant.id)
                  )
                ),
              ]);

            let status: TenantBillingInfo["subscriptionStatus"] = "free";
            if (admin.planId && admin.planId !== "free") {
              const nestedStatus = admin.subscription?.status?.toLowerCase();
              const rootStatus = admin.subscriptionStatus?.toLowerCase();

              if (nestedStatus) {
                status =
                  nestedStatus as TenantBillingInfo["subscriptionStatus"];
              } else if (rootStatus) {
                status = rootStatus as TenantBillingInfo["subscriptionStatus"];
              } else if (admin.stripeSubscriptionId) {
                status = "active";
              } else {
                status = "inactive";
              }
            }

            const planId = admin.planId || "free";
            let matchedPlan = planMap.get(planId);

            if (!matchedPlan && planId !== "free") {
              matchedPlan = plans.find(
                (p) =>
                  p.tier === planId ||
                  p.id.toLowerCase() === planId.toLowerCase()
              );
            }

            if (!matchedPlan && planId !== "free") {
              try {
                const pRef = doc(db, "plans", planId);
                const pSnap = await getDoc(pRef);
                if (pSnap.exists()) {
                  const pData = pSnap.data();
                  matchedPlan = {
                    id: pSnap.id,
                    ...pData,
                    name: pData.name || "Plano sem Nome",
                  } as unknown as UserPlan;
                }
              } catch {
                /* ignore */
              }
            }

            const planName =
              matchedPlan?.name ||
              (planId === "free" ? "Gratuito" : "Plano Personalizado");

            const customFeatures =
              (tenant as unknown as { customFeatures?: Partial<PlanFeatures> })
                .customFeatures || {};
            const finalFeatures = matchedPlan?.features
              ? { ...matchedPlan.features, ...customFeatures }
              : undefined;

            return {
              tenant,
              admin,
              planId,
              planName,
              planFeatures: finalFeatures,
              billingInterval: admin.billingInterval || "monthly",
              subscriptionStatus: status,
              amount: 0,
              addOns,
              nextBillingDate: undefined,
              usage: {
                users: usersCount.data().count,
                products: productsCount.data().count,
                clients: clientsCount.data().count,
                proposals: proposalsCount.data().count,
              },
            };
          } catch (err) {
            console.error(`Error processing tenant ${tenant.id}:`, err);
            return null;
          }
        })
      );

      return billingInfos.filter(
        (info): info is TenantBillingInfo => info !== null
      );
    } catch (error) {
      console.error("AdminService.getAllTenantsBilling error:", error);
      throw error;
    }
  },
};
