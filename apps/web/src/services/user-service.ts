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

export const UserService = {
  /**
   * Get admin user for a specific tenant
   * Returns the first admin or any user if no admin found
   */
  getTenantAdminUser: async (tenantId: string): Promise<User | null> => {
    try {
      // First try to find admin user
      const adminQuery = query(
        collection(db, "users"),
        where("tenantId", "==", tenantId),
        where("role", "==", "admin"),
      );
      const adminSnap = await getDocs(adminQuery);

      if (!adminSnap.empty) {
        const userData = adminSnap.docs[0].data();
        return {
          id: adminSnap.docs[0].id,
          ...userData,
        } as User;
      }

      // Fallback: get any user from tenant
      const usersQuery = query(
        collection(db, "users"),
        where("tenantId", "==", tenantId),
      );
      const usersSnap = await getDocs(usersQuery);

      if (!usersSnap.empty) {
        const userData = usersSnap.docs[0].data();
        return {
          id: usersSnap.docs[0].id,
          ...userData,
        } as User;
      }

      return null;
    } catch (error) {
      console.error("Error fetching tenant admin user:", error);
      return null;
    }
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
    phoneNumber?: string;
    onboarding?: UserOnboardingState;
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
