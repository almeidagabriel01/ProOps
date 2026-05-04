import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig<T> {
  key: keyof T | string | null;
  direction: SortDirection;
}

export function useSort<T>(items: T[], initialConfig?: SortConfig<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(
    initialConfig || { key: null, direction: null },
  );

  const requestSort = useCallback((key: keyof T | string) => {
    setSortConfig((current) => {
      // If clicking on a new key, start with 'asc'
      if (current.key !== key) {
        return { key, direction: "asc" };
      }

      // If clicking on the same key, cycle: asc -> desc -> null (reset)
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      if (current.direction === "desc") {
        return { key: null, direction: null };
      }

      // Default fallback
      return { key, direction: "asc" };
    });
  }, []);

  const sortedItems = useMemo(() => {
    const { key, direction } = sortConfig;
    if (!key || !direction) {
      return items;
    }

    return [...items].sort((a, b) => {
      // Handle nested properties if key is a string like "client.name"
      // For now, let's assume flat or simple access.
      // We can use a helper to get value.
      const getValue = (obj: T, path: string | keyof T) => {
        if (typeof path !== "string") return obj[path];
        return path.split(".").reduce((o, i) => {
          if (o && typeof o === "object") {
            return (o as Record<string, unknown>)[i];
          }
          return undefined;
        }, obj as unknown);
      };

      const valA = getValue(a, key);
      const valB = getValue(b, key);

      if (valA === valB) return 0;

      // Handle nulls/undefined always at the end? Or standard behavior?
      // Let's stick to standard behavior for now.
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      // String comparison for text
      if (typeof valA === "string" && typeof valB === "string") {
        return direction === "asc"
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : valB.localeCompare(valA, undefined, { numeric: true });
      }

      // Numeric/Date comparison
      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;

      return 0;
    });
  }, [items, sortConfig]);

  return { items: sortedItems, requestSort, sortConfig };
}
