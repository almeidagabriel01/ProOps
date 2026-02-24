"use client";

import * as React from "react";
import { Tenant, User } from "@/types"; // Keep Type
import { TenantService } from "@/services/tenant-service";
import { useAuth } from "@/providers/auth-provider";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TenantContextType {
  tenant: Tenant | null;
  tenantOwner: User | null;
  isLoading: boolean;
  refreshTenant: () => void;
  clearViewingTenant: () => void;
  setViewingTenant: (tenant: Tenant) => void;
}

const TenantContext = React.createContext<TenantContextType>({
  tenant: null,
  tenantOwner: null,
  isLoading: true,
  refreshTenant: () => {},
  clearViewingTenant: () => {},
  setViewingTenant: () => {},
});

function resolveSafeTenantColor(input: unknown): string {
  const normalized = String(input || "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    return normalized;
  }
  return "#3b82f6";
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = React.useState<Tenant | null>(null);
  const [tenantOwner, setTenantOwner] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const { user } = useAuth();

  // Use ref to track current tenant ID without causing re-renders
  const currentTenantIdRef = React.useRef<string | null>(null);
  // Track the last refreshTrigger value to detect when explicit refresh was requested
  const lastRefreshTriggerRef = React.useRef(0);

  const loadTenant = React.useCallback(async () => {
    // Check for "Viewing As" override (Super Admin feature)
    const viewingAsId =
      typeof window !== "undefined"
        ? sessionStorage.getItem("viewingAsTenant")
        : null;

    let tenantIdToLoad = viewingAsId;

    if (!tenantIdToLoad && user && user.tenantId) {
      if (user.role === "superadmin") {
        // If superadmin, do NOT auto-load their "default" tenant.
        // They should legally be viewing "No Tenant" unless Impersonating.
        tenantIdToLoad = null;
      } else {
        tenantIdToLoad = user.tenantId;
      }
    }

    // Check if this is a forced refresh (refreshTrigger changed)
    const isForceRefresh = refreshTrigger !== lastRefreshTriggerRef.current;
    lastRefreshTriggerRef.current = refreshTrigger;

    // Skip if we already have the correct tenant loaded AND this is not a forced refresh
    if (
      currentTenantIdRef.current === tenantIdToLoad &&
      !isLoading &&
      !isForceRefresh
    ) {
      return;
    }

    setIsLoading(true);

    if (tenantIdToLoad) {
      try {
        const fetchedTenant = await TenantService.getTenantById(tenantIdToLoad);
        if (fetchedTenant) {
          setTenant(fetchedTenant);
          currentTenantIdRef.current = fetchedTenant.id;

          // Fetch Tenant Owner
          try {
            // For members, fetch owner directly by masterId (they have permission)
            // For admins/masters, use query to find owner in tenant
            const isMember =
              user?.masterId && user?.role?.toLowerCase() === "member";
            const isSuperAdmin = user?.role?.toLowerCase() === "superadmin";

            if (isMember && user.masterId) {
              // Member: fetch their master directly
              const masterDoc = await getDoc(doc(db, "users", user.masterId));
              if (masterDoc.exists()) {
                setTenantOwner({
                  id: masterDoc.id,
                  ...masterDoc.data(),
                } as User);
              } else {
                setTenantOwner(null);
              }
            } else if (isSuperAdmin || !user?.masterId) {
              // Admin/Master/SuperAdmin: query users in tenant to find owner
              const q = query(
                collection(db, "users"),
                where("tenantId", "==", fetchedTenant.id),
                limit(20),
              );

              const usersSnap = await getDocs(q);
              if (!usersSnap.empty) {
                // Client-side filter for the "Master" / Owner
                // The owner is the one with no masterId
                const owner = usersSnap.docs
                  .map((d) => ({ id: d.id, ...d.data() }) as User)
                  .find((u) => !u.masterId);

                if (owner) {
                  setTenantOwner(owner);
                } else {
                  // Fallback: pick the first one or one with admin role?
                  setTenantOwner(
                    usersSnap.docs.map(
                      (d) => ({ id: d.id, ...d.data() }) as User,
                    )[0],
                  );
                  console.warn(
                    `Could not identify explicit owner for tenant ${fetchedTenant.id}, using first user.`,
                  );
                }
              } else {
                setTenantOwner(null);
              }
            } else {
              setTenantOwner(null);
            }
          } catch (ownerErr) {
            console.error("Error fetching tenant owner", ownerErr);
            setTenantOwner(null);
          }
        } else {
          console.warn(`Tenant ${tenantIdToLoad} not found in Firestore`);
          setTenant(null);
          setTenantOwner(null);
          currentTenantIdRef.current = null;
        }
      } catch (error) {
        console.error("Error loading tenant", error);
        setTenant(null);
        setTenantOwner(null);
        currentTenantIdRef.current = null;
      }
    } else {
      setTenant(null);
      setTenantOwner(null);
      currentTenantIdRef.current = null;
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshTrigger]);

  React.useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  // Apply tenant theme synchronously to avoid flash
  React.useLayoutEffect(() => {
    if (tenant) {
      const safePrimaryColor = resolveSafeTenantColor(tenant.primaryColor);
      document.documentElement.style.setProperty(
        "--primary",
        safePrimaryColor,
      );
      // We could add more advanced theming here later
      const styleId = "tenant-styles";
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
               ::selection {
               background-color: ${safePrimaryColor} !important;
                   color: #ffffff !important;
               }
               .tenant-border {
               border-color: ${safePrimaryColor} !important;
               }
           `;
    } else {
      // Reset to default system theme (e.g. Blue) when no tenant aka Admin View
      document.documentElement.style.removeProperty("--primary");
      const styleId = "tenant-styles";
      const styleTag = document.getElementById(styleId);
      if (styleTag) {
        styleTag.remove();
      }
    }
  }, [tenant]);

  const refreshTenant = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const clearViewingTenant = () => {
    sessionStorage.removeItem("viewingAsTenant");
    setRefreshTrigger((prev) => prev + 1);
  };

  const setViewingTenant = (newTenant: Tenant) => {
    sessionStorage.setItem("viewingAsTenant", newTenant.id);
    setTenant(newTenant); // Immediate update
    // We don't trigger refresh here because we just manually set the state
    // ideally we should also fetch owner here or trigger refresh
    refreshTenant(); // Trigger full refresh to get owner data
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantOwner,
        isLoading,
        refreshTenant,
        clearViewingTenant,
        setViewingTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => React.useContext(TenantContext);
