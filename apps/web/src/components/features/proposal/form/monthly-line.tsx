"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { ProposalProduct } from "@/types/proposal";

/**
 * Marcar uma linha da proposta como mensalidade (monitoramento, manutenção,
 * suporte). O formulário oferece a ação por contexto, para ela não atravessar
 * as três seções de itens por prop. Sem o provedor, ou sem o módulo de
 * contratos no plano, a chave não aparece; uma linha que já é mensal continua
 * mostrando a chave, para poder voltar atrás.
 */

interface MonthlyLineContextValue {
  enabled: boolean;
  toggle: (product: ProposalProduct, systemInstanceId?: string) => void;
}

const MonthlyLineContext = React.createContext<MonthlyLineContextValue | null>(null);

interface MonthlyLineProviderProps {
  enabled: boolean;
  onToggle: (
    productId: string,
    isMonthly: boolean,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  children: React.ReactNode;
}

export function MonthlyLineProvider({ enabled, onToggle, children }: MonthlyLineProviderProps) {
  const value = React.useMemo<MonthlyLineContextValue>(
    () => ({
      enabled,
      toggle: (product, systemInstanceId) =>
        onToggle(
          product.productId,
          product.isMonthly !== true,
          systemInstanceId ?? product.systemInstanceId,
          product.itemType || "product",
          product.lineItemId,
        ),
    }),
    [enabled, onToggle],
  );
  return <MonthlyLineContext.Provider value={value}>{children}</MonthlyLineContext.Provider>;
}

interface MonthlyLineSwitchProps {
  product: ProposalProduct;
  systemInstanceId?: string;
  disabled?: boolean;
  /** A linha compacta da seção de sistemas, ao lado do "Ativo". */
  compact?: boolean;
}

export function MonthlyLineSwitch({ product, systemInstanceId, disabled, compact }: MonthlyLineSwitchProps) {
  const ctx = React.useContext(MonthlyLineContext);
  const isMonthly = product.isMonthly === true;
  if (!ctx || (!ctx.enabled && !isMonthly)) return null;
  const id = `monthly-${product.lineItemId ?? product.productId}`;
  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-1" title="Cobrar este item todo mês, fora do total da venda">
        <label htmlFor={id} className="text-[10px] text-muted-foreground">
          Mensal
        </label>
        <Switch
          id={id}
          checked={isMonthly}
          disabled={disabled}
          onCheckedChange={() => ctx.toggle(product, systemInstanceId)}
          className="scale-75"
          aria-label="Cobrar este item todo mês"
        />
      </div>
    );
  }
  return (
    <div className="my-auto space-y-1">
      <span className="mr-2 text-[10px] text-muted-foreground">Cobrança</span>
      <div className="flex items-center gap-2">
        <Switch
          id={id}
          checked={isMonthly}
          disabled={disabled}
          onCheckedChange={() => ctx.toggle(product, systemInstanceId)}
          aria-label="Cobrar este item todo mês"
        />
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {isMonthly ? "Mensal" : "Única"}
        </label>
      </div>
    </div>
  );
}

export function MonthlyLineBadge({ product }: { product: Pick<ProposalProduct, "isMonthly"> }) {
  if (product.isMonthly !== true) return null;
  return (
    <Badge
      variant="default"
      className="h-auto shrink-0 border-0 bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-700 hover:bg-violet-500/15 dark:text-violet-300"
    >
      Mensal
    </Badge>
  );
}
