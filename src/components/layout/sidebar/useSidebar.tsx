"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { menuItems, MenuItem } from "./config";

interface UseSidebarReturn {
  isExpanded: boolean;
  userPlanName: string | null;
  expandedMenus: Set<string>;
  visibleMenuItems: MenuItem[];
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  toggleSubmenu: (href: string) => void;
  isMenuActive: (item: MenuItem) => boolean;
  isParentActive: (item: MenuItem) => boolean;
  isChildActive: (href: string) => boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export function useSidebar(
  onExpandChange?: (expanded: boolean) => void
): UseSidebarReturn {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasFinancial } = usePlanLimits();
  const { hasPermission, isMaster } = usePermissions();

  const [isExpanded, setIsExpanded] = useState(false);
  const [userPlanName, setUserPlanName] = useState<string | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Filter menu items based on permissions
  const visibleMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Financial requires plan access
      if (item.requiresFinancial && !hasFinancial && !isMaster) return true; // Show but restricted

      // MASTER sees everything
      if (isMaster) return true;

      // MEMBER: check if they can view this page
      if (item.pageId) {
        // For Settings, check if there are any visible children
        if (item.children) {
          const visibleChildren = item.children.filter(
            (child) => !child.masterOnly
          );
          return visibleChildren.length > 0;
        }
        return hasPermission(item.pageId, "view");
      }

      return true;
    });
  }, [isMaster, hasPermission, hasFinancial]);

  // Toggle submenu expansion
  const toggleSubmenu = useCallback((href: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }, []);

  // Auto-expand menu if one of its children is active
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some(
          (child) =>
            pathname === child.href || pathname.startsWith(child.href + "/")
        );
        if (isChildActive) {
          setExpandedMenus((prev) => new Set([...prev, item.href]));
        }
      }
    });
  }, [pathname]);

  // Fetch user's current plan name (or tenant owner's plan for superadmin viewing)
  useEffect(() => {
    const fetchPlanName = async () => {
      // Helper function for robust plan fetch
      const getPlanName = async (planId: string) => {
        if (!planId) return null;
        try {
          // 1. Try fetching by ID
          const docSnap = await getDoc(doc(db, "plans", planId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            return data.name || data.tier;
          }
          // 2. Fallback: Try fetching by tier
          const q = query(
            collection(db, "plans"),
            where("tier", "==", planId)
          );
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const data = qSnap.docs[0].data();
            return data.name || data.tier;
          }
          // 3. Static fallback
          const PLAN_NAMES: Record<string, string> = {
            free: "Gratuito",
            starter: "Starter",
            pro: "Profissional",
            enterprise: "Enterprise",
          };
          return PLAN_NAMES[planId] || null;
        } catch (e) {
          console.error("Plan fetch error", e);
          return null;
        }
      };

      // Check if super admin is viewing another tenant
      const viewingAsTenant =
        typeof window !== "undefined"
          ? localStorage.getItem("viewingAsTenant")
          : null;

      // If super admin is viewing a tenant, get the tenant owner's plan
      if (user?.role === "superadmin" && viewingAsTenant) {
        try {
          // Extract owner ID from tenant ID (format: tenant_{userId})
          const ownerId = viewingAsTenant.replace("tenant_", "");
          const ownerDoc = await getDoc(doc(db, "users", ownerId));
          if (ownerDoc.exists()) {
            const ownerData = ownerDoc.data();
            if (ownerData.planId) {
              const name = await getPlanName(ownerData.planId);
              if (name) {
                setUserPlanName(name);
                return;
              }
            }
            // If no plan, show as free
            setUserPlanName("Gratuito");
            return;
          }
        } catch (error) {
          console.error("Error fetching tenant owner plan:", error);
        }
      }

      // Default behavior for regular users
      if (!user?.planId) {
        setUserPlanName(user?.role === "free" ? "Gratuito" : null);
        return;
      }

      const name = await getPlanName(user.planId);
      if (name) {
        setUserPlanName(name);
      }
    };

    fetchPlanName();
  }, [user?.planId, user?.role]);

  const handleMouseEnter = useCallback(() => {
    setIsExpanded(true);
    onExpandChange?.(true);
  }, [onExpandChange]);

  const handleMouseLeave = useCallback(() => {
    setIsExpanded(false);
    onExpandChange?.(false);
  }, [onExpandChange]);

  const isMenuActive = useCallback(
    (item: MenuItem): boolean => {
      const isMatch =
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(item.href));
      const hasBetterMatch = visibleMenuItems.some(
        (other) =>
          other !== item &&
          other.href.length > item.href.length &&
          pathname.startsWith(other.href)
      );
      const hasChildren = item.children && item.children.length > 0;
      return isMatch && !hasBetterMatch && !hasChildren;
    },
    [pathname, visibleMenuItems]
  );

  const isParentActive = useCallback(
    (item: MenuItem): boolean => {
      return (
        item.children?.some(
          (child) =>
            pathname === child.href || pathname.startsWith(child.href + "/")
        ) ?? false
      );
    },
    [pathname]
  );

  const isChildActive = useCallback(
    (href: string): boolean => {
      return pathname === href || pathname.startsWith(href + "/");
    },
    [pathname]
  );

  return {
    isExpanded,
    userPlanName,
    expandedMenus,
    visibleMenuItems,
    handleMouseEnter,
    handleMouseLeave,
    toggleSubmenu,
    isMenuActive,
    isParentActive,
    isChildActive,
    onExpandChange,
  };
}
