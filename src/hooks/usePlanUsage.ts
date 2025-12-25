"use client";

import { useState, useEffect, useMemo } from "react";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface UsageItem {
  current: number;
  limit: number;
  percentage: number;
  isUnlimited: boolean;
  label: string;
  icon?: string;
}

export interface UsePlanUsageReturn {
  proposals: UsageItem;
  clients: UsageItem;
  products: UsageItem;
  users: UsageItem;
  storage: UsageItem;
  isLoading: boolean;
  overallPercentage: number;
  criticalItems: UsageItem[];
}

export function usePlanUsage(): UsePlanUsageReturn {
  const {
    features,
    isLoading: planLoading,
    getProposalCount,
    getClientCount,
    getProductCount,
    getUserCount,
  } = usePlanLimits();

  const [counts, setCounts] = useState({
    proposals: 0,
    clients: 0,
    products: 0,
    users: 0,
    storageMB: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      if (planLoading || !features) return;

      setIsLoading(true);
      try {
        const [proposalCount, clientCount, productCount, userCount] = await Promise.all([
          getProposalCount(),
          getClientCount(),
          getProductCount(),
          getUserCount(),
        ]);

        setCounts({
          proposals: proposalCount,
          clients: clientCount,
          products: productCount,
          users: userCount,
          storageMB: 0, // TODO: Implement storage calculation if needed
        });
      } catch (error) {
        console.error("Error fetching usage counts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCounts();
  }, [planLoading, features, getProposalCount, getClientCount, getProductCount, getUserCount]);

  const createUsageItem = (current: number, limit: number, label: string): UsageItem => {
    const isUnlimited = limit === -1;
    const percentage = isUnlimited ? 0 : limit > 0 ? Math.round((current / limit) * 100) : 0;
    
    return {
      current,
      limit,
      percentage: Math.min(percentage, 100),
      isUnlimited,
      label,
    };
  };

  const usageData = useMemo(() => {
    if (!features) {
      const emptyItem: UsageItem = { current: 0, limit: 0, percentage: 0, isUnlimited: false, label: "" };
      return {
        proposals: { ...emptyItem, label: "Propostas" },
        clients: { ...emptyItem, label: "Clientes" },
        products: { ...emptyItem, label: "Produtos" },
        users: { ...emptyItem, label: "Membros" },
        storage: { ...emptyItem, label: "Armazenamento" },
      };
    }

    return {
      proposals: createUsageItem(counts.proposals, features.maxProposals, "Propostas"),
      clients: createUsageItem(counts.clients, features.maxClients, "Clientes"),
      products: createUsageItem(counts.products, features.maxProducts, "Produtos"),
      users: createUsageItem(counts.users, features.maxUsers, "Membros"),
      storage: createUsageItem(counts.storageMB, features.maxStorageMB ?? 50, "Armazenamento"),
    };
  }, [features, counts]);

  // Calculate overall percentage (average of non-unlimited items)
  const overallPercentage = useMemo(() => {
    const items = Object.values(usageData).filter(item => !item.isUnlimited && item.limit > 0);
    if (items.length === 0) return 0;
    return Math.round(items.reduce((sum, item) => sum + item.percentage, 0) / items.length);
  }, [usageData]);

  // Get items that are critical (above 80% usage)
  const criticalItems = useMemo(() => {
    return Object.values(usageData)
      .filter(item => !item.isUnlimited && item.percentage >= 80)
      .sort((a, b) => b.percentage - a.percentage);
  }, [usageData]);

  return {
    ...usageData,
    isLoading: isLoading || planLoading,
    overallPercentage,
    criticalItems,
  };
}
