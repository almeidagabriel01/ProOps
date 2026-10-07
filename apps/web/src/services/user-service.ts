import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { User, UserOnboardingState } from "@/types";
import { AdminService } from "@/services/admin-service";

const TENANT_OWNER_CACHE_TTL_MS = 5 * 60 * 1000;
const tenantOwnerCache = new Map<
  string,
  { promise: Promise<User | null>; expiresAt: number }
>();

export function clearTenantOwnerCacheForTest(): void {
  tenantOwnerCache.clear();
}

export const UserService = {
  /**
   * Dono da empresa vista pelo super admin no "Acessar Painel".
   *
   * Usa a mesma regra do backend (`resolveTenantOwnerUid`, que marca o "Dono"
   * na lista de membros do painel) e lê o doc completo dele, que a aba de
   * assinatura precisa. Sem dono, devolve null: nunca outra pessoa da empresa
   * no lugar dele. A versão antiga buscava `role == "admin"` (o dono costuma
   * estar gravado como ADMIN ou MASTER) e, sem achar, devolvia qualquer usuário
   * do tenant, e o Perfil mostrava o e-mail de um membro.
   */
  getTenantOwnerUser: (tenantId: string): Promise<User | null> => {
    const cached = tenantOwnerCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = (async () => {
      const members = await AdminService.getTenantMembers(tenantId);
      const owner = members.find((member) => member.isOwner);
      if (!owner) return null;
      return UserService.getUserById(owner.id);
    })();
    tenantOwnerCache.set(tenantId, {
      promise,
      expiresAt: Date.now() + TENANT_OWNER_CACHE_TTL_MS,
    });
    // Falha não fica em cache: a próxima tela tenta de novo.
    promise.catch(() => tenantOwnerCache.delete(tenantId));
    return promise;
  },

  /**
   * Get user by ID
   */
  getUserById: async (userId: string): Promise<User | null> => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return {
          id: userSnap.id,
          ...userSnap.data(),
        } as User;
      }

      return null;
    } catch (error) {
      console.error("Error fetching user:", error);
      return null;
    }
  },
  /**
   * Update user data
   */
  updateUser: async (userId: string, data: Partial<User>): Promise<void> => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, data);
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  },

  updateProfile: async (data: {
    name?: string;
    phoneNumber?: string | null;
    onboarding?: UserOnboardingState;
    preferences?: { liaSoundsEnabled: boolean };
  }): Promise<void> => {
    try {
      const { callApi } = await import("@/lib/api-client");
      await callApi("v1/profile", "PUT", data);
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  },

  updateOnboarding: async (onboarding: UserOnboardingState): Promise<void> => {
    try {
      const { callApi } = await import("@/lib/api-client");
      await callApi("v1/profile", "PUT", { onboarding });
    } catch (error) {
      console.error("Error updating onboarding:", error);
      throw error;
    }
  },

  /**
   * Get user by Phone Number (for WhatsApp integration)
   */
  getUserByPhoneNumber: async (phoneNumber: string): Promise<User | null> => {
    try {
      // Remove non-numeric characters for flexible matching
      const cleanPhone = phoneNumber.replace(/\D/g, "");

      // Query users where phoneNumber matches
      // Note: This assumes the database stores numbers in a consistent format or we query by the exact stored string.
      // For now, we'll try to query by the exact `phoneNumber` field.
      const usersQuery = query(
        collection(db, "users"),
        where("phoneNumber", "==", cleanPhone),
      );

      const querySnapshot = await getDocs(usersQuery);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return {
          id: userDoc.id,
          ...userDoc.data(),
        } as User;
      }

      return null;
    } catch (error) {
      console.error("Error fetching user by phone:", error);
      return null;
    }
  },
};
