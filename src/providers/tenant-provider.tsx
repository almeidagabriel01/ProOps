"use client";

import * as React from "react";
import { Tenant } from "@/types"; // Keep Type
import { TenantService } from "@/services/tenant-service";
import { useAuth } from "@/providers/auth-provider";

interface TenantContextType {
  tenant: Tenant | null;
  isLoading: boolean;
  refreshTenant: () => void;
  clearViewingTenant: () => void;
  setViewingTenant: (tenant: Tenant) => void;
}

const TenantContext = React.createContext<TenantContextType>({
  tenant: null,
  isLoading: true,
  refreshTenant: () => { },
  clearViewingTenant: () => { },
  setViewingTenant: () => { },
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = React.useState<Tenant | null>(null);
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
        } else {
          console.warn(`Tenant ${tenantIdToLoad} not found in Firestore`);
          setTenant(null);
          currentTenantIdRef.current = null;
        }
      } catch (error) {
        console.error("Error loading tenant", error);
        setTenant(null);
        currentTenantIdRef.current = null;
      }
    } else {
      setTenant(null);
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
        tenant.primaryColor
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
                   background-color: ${tenant.primaryColor} !important;
                   color: #ffffff !important;
               }
               .tenant-border {
                   border-color: ${tenant.primaryColor} !important;
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
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
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
