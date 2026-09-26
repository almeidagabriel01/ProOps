"use client";

import * as React from "react";
import { ClientService } from "@/services/client-service";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  applySellerCommission,
  type LinkedSellerContact,
} from "@/lib/contacts/seller-commission";
import type { Proposal } from "@/types/proposal";

interface UseSellerCommissionParams {
  tenantId: string | null | undefined;
  /** Proposta nova: a comissão do responsável padrão (quem cria) entra sozinha. */
  isNew: boolean;
  readOnly: boolean;
  currentUserId: string | null | undefined;
  formData: Partial<Proposal>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
}

/**
 * A comissão acompanha o responsável pela venda (Pro e Enterprise, onde ele
 * existe). Proposta já salva não muda sozinha ao abrir: só quando alguém troca
 * o responsável.
 */
export function useSellerCommission({
  tenantId,
  isNew,
  readOnly,
  currentUserId,
  formData,
  setFormData,
}: UseSellerCommissionParams) {
  const { hasSalesGoals } = usePlanLimits();
  const enabled = hasSalesGoals && !readOnly;
  const [sellers, setSellers] = React.useState<LinkedSellerContact[]>([]);
  const appliedDefault = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || !tenantId) return;
    let cancelled = false;
    ClientService.getClientsByTypes(tenantId, ["vendedor"])
      .then((contacts) => {
        if (cancelled) return;
        setSellers(
          contacts
            .filter((c) => c.linkedMemberId)
            .map((c) => ({
              id: c.id,
              name: c.name,
              linkedMemberId: c.linkedMemberId,
              commissionPercentage: c.commissionPercentage ?? null,
            })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId]);

  // Proposta nova: quem cria é o responsável até que alguém troque, então a
  // comissão dele (se for vendedor ligado) já entra.
  React.useEffect(() => {
    if (!enabled || !isNew || appliedDefault.current || sellers.length === 0) return;
    if (formData.sellerId !== undefined || !currentUserId) return;
    appliedDefault.current = true;
    setFormData((prev) => ({
      ...prev,
      commissions: applySellerCommission(prev.commissions || [], sellers, null, currentUserId),
    }));
  }, [enabled, isNew, sellers, formData.sellerId, currentUserId, setFormData]);

  const changeSeller = React.useCallback(
    (nextSellerId: string | null) => {
      setFormData((prev) => {
        const previous = prev.sellerId === undefined ? currentUserId : prev.sellerId;
        return {
          ...prev,
          sellerId: nextSellerId,
          commissions: enabled
            ? applySellerCommission(prev.commissions || [], sellers, previous, nextSellerId)
            : prev.commissions,
        };
      });
    },
    [currentUserId, enabled, sellers, setFormData],
  );

  return { changeSeller };
}
