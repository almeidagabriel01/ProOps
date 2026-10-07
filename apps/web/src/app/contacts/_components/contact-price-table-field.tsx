"use client";

import * as React from "react";
import Link from "next/link";
import { FormItem, FormStatic } from "@/components/ui/form-components";
import { Select } from "@/components/ui/select";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermission } from "@/hooks/usePermission";
import { usePriceTableOptions } from "@/hooks/use-price-tables";
import { describePriceTableAdjustment } from "@/lib/pricing/price-table";
import type { ClientType } from "@/services/client-service";

/**
 * Se o campo aparece: só contato do tipo cliente tem tabela de preço, e só
 * com o módulo no plano. Fora disso o cliente compra pela tabela padrão.
 */
export function showsPriceTableField(types: readonly ClientType[], hasPriceTables: boolean): boolean {
  return hasPriceTables && types.includes("cliente");
}

/** Valor que o cadastro manda ao salvar: deixar de ser cliente volta para a padrão. */
export function priceTableIdForSave(
  types: readonly ClientType[],
  priceTableId: string | null,
): string | null {
  return types.includes("cliente") ? priceTableId : null;
}

interface ContactPriceTableFieldProps {
  types: ClientType[];
  value: string | null;
  onChange: (priceTableId: string | null) => void;
  readOnly?: boolean;
}

const DEFAULT_LABEL = "Tabela padrão (catálogo)";

/**
 * "Tabela de preço" do cliente. A escolhida vale sozinha nas propostas dele;
 * vazio é a tabela padrão, o próprio catálogo.
 */
export function ContactPriceTableField({
  types,
  value,
  onChange,
  readOnly,
}: ContactPriceTableFieldProps) {
  const { hasPriceTables } = usePlanLimits();
  // "Tabela de preço do cliente": sem ela a escolha fica só leitura.
  const canChoose = usePermission("clients", "priceTable");
  const visible = showsPriceTableField(types, hasPriceTables);
  const { options, isLoading } = usePriceTableOptions(visible);

  if (!visible) return null;

  const label = (option: { name: string; adjustmentPercent: number }) =>
    `${option.name}: ${describePriceTableAdjustment(option.adjustmentPercent).toLowerCase()}`;

  if (readOnly || !canChoose) {
    const current = options.find((option) => option.id === value);
    return (
      <FormStatic
        label="Tabela de preço"
        value={value ? (current ? label(current) : isLoading ? "Carregando..." : "") : DEFAULT_LABEL}
        placeholder={DEFAULT_LABEL}
      />
    );
  }

  const knowsValue = !value || options.some((option) => option.id === value);

  return (
    <FormItem label="Tabela de preço" htmlFor="priceTableId">
      <div className="space-y-2">
        <Select
          id="priceTableId"
          aria-label="Tabela de preço"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={isLoading}
          disableSort
        >
          <option value="">{DEFAULT_LABEL}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {label(option)}
            </option>
          ))}
          {!knowsValue && !isLoading && value && (
            <option value={value}>Tabela indisponível</option>
          )}
        </Select>
        <p className="text-xs text-muted-foreground">
          Vale sozinha nas propostas deste cliente.{" "}
          <Link href="/products?aba=tabelas-de-preco" className="underline hover:text-foreground">
            Ver as tabelas
          </Link>
        </p>
      </div>
    </FormItem>
  );
}
