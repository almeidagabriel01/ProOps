"use client";

import { useState, useCallback } from "react";
import { ConnectedAccount } from "@/types";
import {
  ConnectedAccountService,
  CreateConnectedAccountInput,
  UpdateConnectedAccountInput,
} from "@/services/connected-account-service";
import { toast } from "react-toastify";

export const useConnectedAccounts = (tenantId?: string) => {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await ConnectedAccountService.getConnectedAccounts(tenantId);
      setAccounts(data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao buscar contas conectadas.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const createAccount = async (data: CreateConnectedAccountInput) => {
    try {
      await ConnectedAccountService.createConnectedAccount(data);
      toast.success("Conta vinculada com sucesso.");
      fetchAccounts();
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Erro ao conectar conta.");
      return false;
    }
  };

  const updateAccount = async (id: string, data: UpdateConnectedAccountInput) => {
    try {
      await ConnectedAccountService.updateConnectedAccount(id, data);
      toast.success("Informações da conta atualizadas.");
      fetchAccounts();
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar conta.");
      return false;
    }
  };

  const removeAccount = async (id: string) => {
    try {
      await ConnectedAccountService.removeConnectedAccount(id);
      toast.success("Conexão removida com sucesso.");
      fetchAccounts();
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover conexão.");
      return false;
    }
  };

  const syncAccount = async (id: string) => {
    try {
      const { importedCount } = await ConnectedAccountService.syncAccount(id);
      toast.success(`${importedCount} transações importadas.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Erro ao sincronizar conta.");
      return false;
    }
  };

  return {
    accounts,
    loading,
    fetchAccounts,
    createAccount,
    updateAccount,
    removeAccount,
    syncAccount,
  };
};
