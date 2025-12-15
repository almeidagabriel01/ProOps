import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { User } from "@/types";

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
                where("role", "==", "admin")
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
                where("tenantId", "==", tenantId)
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
};
