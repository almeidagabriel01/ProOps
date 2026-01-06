"use client";

import * as React from "react";
import { Tenant, User } from "@/types"; // Keep Type
import { TenantService } from "@/services/tenant-service";
import { useAuth } from "@/providers/auth-provider";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
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
  refreshTenant: () => { },
  clearViewingTenant: () => { },
  setViewingTenant: () => { },
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = React.useState<Tenant | null>(null);
  const [tenantOwner, setTenantOwner] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const { user } = useAuth();

  // Use ref to track current tenant ID without causing re-renders
  const currentTenantIdRef = React.useRef<string | null>(null);

  const loadTenant = React.useCallback(async () => {
    // Check for "Viewing As" override (Super Admin feature)
    const viewingAsId =
      typeof window !== "undefined"
        ? localStorage.getItem("viewingAsTenant")
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

    // Skip if we already have the correct tenant loaded
    if (currentTenantIdRef.current === tenantIdToLoad && !isLoading) {
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
            // Owner is usually the one with masterId: null (or undefined) in this tenant
            // And usually role 'admin' or 'free' - basically the root user
            const q = query(
              collection(db, "users"),
              where("tenantId", "==", fetchedTenant.id),
              limit(20)
            );

            const usersSnap = await getDocs(q);
            if (!usersSnap.empty) {
              // Client-side filter for the "Master" / Owner
              // The owner is the one with no masterId
              const owner = usersSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as User))
                .find(u => !u.masterId);

              if (owner) {
                setTenantOwner(owner);
              } else {
                // Fallback: pick the first one or one with admin role?
                setTenantOwner(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User))[0]);
                console.warn(`Could not identify explicit owner for tenant ${fetchedTenant.id}, using first user.`);
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
      document.documentElement.style.setProperty(
        "--primary",
        tenant.primaryColor || "#3b82f6"
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
                   background-color: ${tenant.primaryColor || "#3b82f6"} !important;
                   color: #ffffff !important;
               }
               .tenant-border {
                   border-color: ${tenant.primaryColor || "#3b82f6"} !important;
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
    localStorage.removeItem("viewingAsTenant");
    setRefreshTrigger((prev) => prev + 1);
  };

  const setViewingTenant = (newTenant: Tenant) => {
    localStorage.setItem("viewingAsTenant", newTenant.id);
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
