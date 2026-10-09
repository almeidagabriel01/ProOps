"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatCurrency } from "@/utils/format";
import {
  decimalInput,
  newManualLine,
  parseDecimal,
  type ManualLineForm,
} from "@/lib/fiscal/nfe-form";
import type { IcmsKind } from "@/lib/fiscal/tax-codes";
import type { FiscalNfeView } from "@/services/fiscal-service";
import type { Product } from "@/services/product-service";
import { Field } from "./field";
import { LineTaxesPanel } from "./line-taxes-panel";

interface ManualLinesEditorProps {
  lines: ManualLineForm[];
  onChange: (lines: ManualLineForm[]) => void;
  products: Product[];
  /** Linhas como a prévia devolveu: CFOP e os impostos aplicados. */
  previewLines?: FiscalNfeView["linhas"];
  icmsKind: IcmsKind;
  disabled?: boolean;
}

/** Unidade fiscal a partir do estoque do catálogo, como o backend deriva. */
function unidadeDoProduto(product: Product): string {
  if (product.pricingModel?.mode === "curtain_meter") return "M2";
  return product.inventoryUnit === "meter" ? "M" : "UN";
}

/**
 * Itens da nota avulsa. Cada linha vem do catálogo (que preenche descrição,
 * NCM e unidade) ou é digitada inteira: quem manda um equipamento do cliente
 * para o conserto nem sempre o tem no catálogo.
 */
export function ManualLinesEditor({
  lines,
  onChange,
  products,
  previewLines,
  icmsKind,
  disabled,
}: ManualLinesEditorProps) {
  const productOptions = React.useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.name,
        description: product.ncm ? `NCM ${product.ncm}` : "Sem NCM no cadastro",
      })),
    [products],
  );

  const update = (key: string, patch: Partial<ManualLineForm>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const pickProduct = (key: string, productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      update(key, { productId: undefined });
      return;
    }
    update(key, {
      productId: product.id,
      codigo: undefined,
      descricao: product.name,
      ncm: product.ncm ?? "",
      unidade: unidadeDoProduto(product),
      valorUnitario: parseDecimal(String(product.price ?? "")) ?? 0,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {lines.map((line, index) => {
        const preview = previewLines?.[index];
        const total = (parseDecimal(line.quantidade) ?? 0) * line.valorUnitario;
        return (
          <div key={line.key} className="flex flex-col gap-3 rounded-xl border p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Item {index + 1}</p>
              <div className="flex items-center gap-2">
                {preview && (
                  <span className="text-xs text-muted-foreground">
                    CFOP {preview.cfop || "a definir"}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Remover o item ${index + 1}`}
                  disabled={disabled}
                  onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Field label="Do catálogo (opcional)" htmlFor={`${line.key}-produto`}>
              <SearchableSelect
                id={`${line.key}-produto`}
                options={productOptions}
                value={line.productId ?? ""}
                disabled={disabled}
                placeholder="Digitar o item à mão"
                searchPlaceholder="Buscar produto"
                emptyMessage="Nenhum produto no catálogo"
                onValueChange={(value) => pickProduct(line.key, value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <Field label="Descrição" htmlFor={`${line.key}-descricao`} className="sm:col-span-6">
                <Input
                  id={`${line.key}-descricao`}
                  value={line.descricao}
                  disabled={disabled}
                  maxLength={120}
                  onChange={(e) => update(line.key, { descricao: e.target.value })}
                />
              </Field>
              <Field
                label="NCM"
                htmlFor={`${line.key}-ncm`}
                className="sm:col-span-2"
                hint="8 dígitos, como na nota de compra."
              >
                <Input
                  id={`${line.key}-ncm`}
                  inputMode="numeric"
                  maxLength={10}
                  value={line.ncm}
                  disabled={disabled}
                  onChange={(e) => update(line.key, { ncm: e.target.value.replace(/[^\d.]/g, "") })}
                />
              </Field>
              <Field label="Unidade" htmlFor={`${line.key}-unidade`} className="sm:col-span-1">
                <Input
                  id={`${line.key}-unidade`}
                  maxLength={6}
                  value={line.unidade}
                  disabled={disabled}
                  onChange={(e) => update(line.key, { unidade: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Quantidade" htmlFor={`${line.key}-qtd`} className="sm:col-span-1">
                <Input
                  id={`${line.key}-qtd`}
                  inputMode="decimal"
                  value={line.quantidade}
                  disabled={disabled}
                  onChange={(e) =>
                    update(line.key, { quantidade: decimalInput(e.target.value) })
                  }
                />
              </Field>
              <Field label="Valor unitário" htmlFor={`${line.key}-valor`} className="sm:col-span-2">
                <CurrencyInput
                  id={`${line.key}-valor`}
                  value={line.valorUnitario}
                  disabled={disabled}
                  placeholder="0,00"
                  onChange={(e) =>
                    update(line.key, { valorUnitario: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <LineTaxesPanel
                  id={line.key}
                  value={line.impostos}
                  preview={preview}
                  icmsKind={icmsKind}
                  disabled={disabled}
                  onChange={(impostos) => update(line.key, { impostos })}
                />
              </div>
              <p className="text-sm sm:pt-2">
                Total do item: <span className="font-semibold">{formatCurrency(total)}</span>
              </p>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={disabled}
        onClick={() => onChange([...lines, newManualLine()])}
      >
        <Plus className="mr-2 h-4 w-4" />
        Acrescentar item
      </Button>
    </div>
  );
}
