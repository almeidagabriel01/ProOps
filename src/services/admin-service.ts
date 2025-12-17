import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, getCountFromServer, updateDoc } from "firebase/firestore";
import { Tenant, User, AddonType, PlanFeatures } from "@/types";
import { PlanService } from "./plan-service";

export interface TenantBillingInfo {
    tenant: Tenant;
    admin: User;
    planId: string;
    planName: string;
    planFeatures?: PlanFeatures;
    billingInterval: 'monthly' | 'yearly';
    subscriptionStatus: 'active' | 'inactive' | 'trial' | 'past_due' | 'free';
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
    async updateTenantLimits(tenantId: string, customFeatures: Partial<PlanFeatures>) {
        try {
            const ref = doc(db, "tenants", tenantId);
            await updateDoc(ref, {
                customFeatures: customFeatures
            });
            return true;
        } catch (error) {
            console.error("Error updating tenant limits:", error);
            throw error;
        }
    },

    async getAllTenantsBilling(): Promise<TenantBillingInfo[]> {
        try {
            const tenantsSnap = await getDocs(collection(db, "tenants"));
            const tenants = tenantsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant));
            
            // Fetch plans to map names
            const plans = await PlanService.getPlans();
            const planMap = new Map(plans.map(p => [p.id, p]));
            // Also map by tier for fallback
            plans.forEach(p => {
                if (p.tier) planMap.set(p.tier, p);
            });

            // 2. Aggregate data for each tenant
            const billingInfos = await Promise.all(tenants.map(async (tenant): Promise<TenantBillingInfo | null> => {
                try {
                    // Find admin user (try 'admin' role first)
                    const q = query(collection(db, "users"), where("tenantId", "==", tenant.id), where("role", "==", "admin"));
                    const snapshot = await getDocs(q);
                    
                    let admin = snapshot.empty ? null : ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User);

                    // Fallback: If no admin role, find who is paying (has subscriptionId) or just the first user
                    if (!admin) {
                         const qAny = query(collection(db, "users"), where("tenantId", "==", tenant.id));
                         const snapAny = await getDocs(qAny);
                         if (!snapAny.empty) {
                             const payer = snapAny.docs.find(d => d.data().stripeSubscriptionId);
                             admin = payer ? ({ id: payer.id, ...payer.data() } as User) : ({ id: snapAny.docs[0].id, ...snapAny.docs[0].data() } as User);
                         }
                    }

                    if (!admin) return null;

                    const addonsQ = query(collection(db, "purchased_addons"), where("tenantId", "==", tenant.id), where("status", "==", "active"));
                    const addonsSnap = await getDocs(addonsQ);
                    const addOns = addonsSnap.docs.map(d => d.data().addonType as AddonType);

                    // Fetch Counts
                    const [usersCount, productsCount, clientsCount, proposalsCount] = await Promise.all([
                        getCountFromServer(query(collection(db, "users"), where("tenantId", "==", tenant.id))),
                        getCountFromServer(query(collection(db, "products"), where("tenantId", "==", tenant.id))),
                        getCountFromServer(query(collection(db, "clients"), where("tenantId", "==", tenant.id))),
                        getCountFromServer(query(collection(db, "proposals"), where("tenantId", "==", tenant.id)))
                    ]);

                    let status: TenantBillingInfo['subscriptionStatus'] = 'free';
                    if (admin.planId && admin.planId !== 'free') {
                        status = admin.stripeSubscriptionId ? 'active' : 'inactive';
                    }

                    const planId = admin.planId || 'free';
                    let matchedPlan = planMap.get(planId);
                    
                    // 1. Try finding by ID (already done by map)
                    
                    // 2. If not found, try case-insensitive tier search
                    if (!matchedPlan && planId !== 'free') {
                        matchedPlan = plans.find(p => p.tier === planId || p.id.toLowerCase() === planId.toLowerCase());
                    }

                    // 3. Fallback: Direct fetch if still missing (maybe a legacy ID or not in getPlans list)
                    if (!matchedPlan && planId !== 'free') {
                         try {
                              const pRef = doc(db, "plans", planId);
                              const pSnap = await getDoc(pRef);
                              if (pSnap.exists()) {
                                  const pData = pSnap.data();
                                  matchedPlan = { 
                                      id: pSnap.id, 
                                      ...pData,
                                      name: pData.name || "Plano sem Nome"
                                  } as any;
                              }
                         } catch (e) { /* ignore */ }
                    }

                    const planName = matchedPlan?.name || (planId === 'free' ? 'Gratuito' : 'Plano Personalizado');

                    // Merge Custom Features
                    const customFeatures = (tenant as any).customFeatures || {};
                    const finalFeatures = matchedPlan?.features ? { ...matchedPlan.features, ...customFeatures } : undefined;

                    return {
                        tenant,
                        admin,
                        planId,
                        planName,
                        planFeatures: finalFeatures,
                        billingInterval: admin.billingInterval || 'monthly',
                        subscriptionStatus: status,
                        amount: 0, 
                        addOns,
                        nextBillingDate: undefined,
                        usage: {
                            users: usersCount.data().count,
                            products: productsCount.data().count,
                            clients: clientsCount.data().count,
                            proposals: proposalsCount.data().count
                        }
                    };
                } catch (err) {
                    console.error(`Error processing tenant ${tenant.id}:`, err);
                    return null;
                }
            }));

            return billingInfos.filter((info): info is TenantBillingInfo => info !== null);
        } catch (error) {
            console.error("AdminService.getAllTenantsBilling error:", error);
            throw error;
        }
    }
};
