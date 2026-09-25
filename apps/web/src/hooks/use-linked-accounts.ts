"use client";

import * as React from "react";
import {
  LinkedAccountsService,
  type LinkedAccount,
} from "@/services/linked-accounts-service";

export function useLinkedAccounts(enabled = true) {
  const [accounts, setAccounts] = React.useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAccounts(await LinkedAccountsService.list());
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível carregar as contas vinculadas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void load();
  }, [enabled, load]);

  return { accounts, isLoading, error, reload: load };
}
