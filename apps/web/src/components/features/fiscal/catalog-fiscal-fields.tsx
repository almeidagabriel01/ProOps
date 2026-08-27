"use client";

import * as React from "react";
import { Receipt, WandSparkles } from "lucide-react";
import { FormSection, FormGroup, FormItem } from "@/components/ui/form-components";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { FiscalService, type NcmSuggestion } from "@/services/fiscal-service";

/**
 * Fiscal fields of a catalogue entry.
 *
 * Collapsed by default and never marked required: the fields are **optional at
 * cadastro and demanded at issue time** by `fiscal-readiness.ts`, which lists
 * every gap at once. An installer registering a product should not have to stop
 * and classify it fiscally before saving.
 *
 * CFOP, CST/CSOSN and the commercial unit are deliberately absent — they are
 * derived from the operation and the issuer's regime, not from the item.
 */

export interface CatalogFiscalValues {
  ncm: string;
  origem: string;
  codigoLc116: string;
  codigoTributacaoNacional: string;
  aliquotaIss: string;
}

interface CatalogFiscalFieldsProps {
  entityType: "product" | "service";
  values: CatalogFiscalValues;
  onChange: (field: keyof CatalogFiscalValues, value: string) => void;
  disabled?: boolean;
  /** Alimenta a sugestão de NCM — a IA classifica melhor com o contexto todo. */
  suggestionContext?: {
    nome: string;
    descricao?: string;
    categoria?: string;
    fabricante?: string;
  };
}

const ORIGEM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "0", label: "0 — Nacional" },
  { value: "1", label: "1 — Estrangeira, importação direta" },
  { value: "2", label: "2 — Estrangeira, adquirida no mercado interno" },
  { value: "3", label: "3 — Nacional, importação entre 40% e 70%" },
  { value: "4", label: "4 — Nacional, produção conforme processos básicos" },
  { value: "5", label: "5 — Nacional, importação até 40%" },
  { value: "6", label: "6 — Estrangeira, importação direta sem similar nacional" },
  { value: "7", label: "7 — Estrangeira, mercado interno sem similar nacional" },
  { value: "8", label: "8 — Nacional, importação superior a 70%" },
];

export function CatalogFiscalFields({
  entityType,
  values,
  onChange,
  disabled,
  suggestionContext,
}: CatalogFiscalFieldsProps) {
  const [suggestions, setSuggestions] = React.useState<NcmSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  const canSuggest =
    !disabled && !isSuggesting && Boolean(suggestionContext?.nome?.trim());

  async function handleSuggest() {
    if (!suggestionContext?.nome?.trim()) return;
    setIsSuggesting(true);
    try {
      const result = await FiscalService.suggestNcm({
        nome: suggestionContext.nome.trim(),
        descricao: suggestionContext.descricao?.trim() || undefined,
        categoria: suggestionContext.categoria?.trim() || undefined,
        fabricante: suggestionContext.fabricante?.trim() || undefined,
      });
      setSuggestions(result.suggestions ?? []);
      if (!result.suggestions?.length) {
        toast.error("Nenhum NCM sugerido. Informe o código manualmente.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível sugerir o NCM agora.",
      );
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    <FormSection
      title="Dados fiscais"
      description="Só precisam estar preenchidos na hora de emitir a nota. Deixe em branco se ainda não souber."
      icon={Receipt}
      collapsible
      defaultOpen={false}
    >
      {entityType === "product" ? (
        <div className="space-y-5">
          <FormGroup cols={2}>
            <FormItem
              label="NCM"
              htmlFor="fiscal-ncm"
              hint="8 dígitos. Costuma vir na nota do fornecedor."
            >
              <div className="flex gap-2">
                <Input
                  id="fiscal-ncm"
                  name="ncm"
                  inputMode="numeric"
                  placeholder="00000000"
                  maxLength={8}
                  value={values.ncm}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange("ncm", e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={!canSuggest}
                  onClick={handleSuggest}
                  title={
                    suggestionContext?.nome?.trim()
                      ? "Sugerir NCM com IA"
                      : "Informe o nome do produto primeiro"
                  }
                >
                  <WandSparkles className="h-4 w-4" />
                </Button>
              </div>
            </FormItem>

            <FormItem
              label="Origem"
              htmlFor="fiscal-origem"
              hint="Em branco equivale a nacional."
            >
              <Select
                id="fiscal-origem"
                name="origem"
                value={values.origem}
                disabled={disabled}
                onChange={(e) => onChange("origem", e.target.value)}
              >
                <option value="">Nacional (padrão)</option>
                {ORIGEM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormItem>
          </FormGroup>

          {suggestions.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Sugestões da IA — confira antes de usar. A classificação fiscal é
                responsabilidade de quem emite.
              </p>
              <ul className="space-y-1.5">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.ncm}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                      onClick={() => {
                        onChange("ncm", suggestion.ncm.replace(/\D/g, "").slice(0, 8));
                        setSuggestions([]);
                      }}
                    >
                      <span className="font-mono text-sm">{suggestion.ncm}</span>
                      <span className="flex-1 text-sm text-muted-foreground">
                        {suggestion.descricao}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <FormGroup cols={3}>
          <FormItem
            label="Código LC 116"
            htmlFor="fiscal-lc116"
            hint="Item da lista de serviços. Ex.: 31.01, 7.02, 14.06."
          >
            <Input
              id="fiscal-lc116"
              name="codigoLc116"
              placeholder="31.01"
              maxLength={10}
              value={values.codigoLc116}
              disabled={disabled}
              onChange={(e) => onChange("codigoLc116", e.target.value)}
            />
          </FormItem>

          <FormItem
            label="Código de tributação nacional"
            htmlFor="fiscal-tributacao-nacional"
            hint="Layout da NFS-e Nacional. Ex.: 310102."
          >
            <Input
              id="fiscal-tributacao-nacional"
              name="codigoTributacaoNacional"
              placeholder="310102"
              maxLength={20}
              value={values.codigoTributacaoNacional}
              disabled={disabled}
              onChange={(e) => onChange("codigoTributacaoNacional", e.target.value)}
            />
          </FormItem>

          <FormItem
            label="Alíquota de ISS (%)"
            htmlFor="fiscal-aliquota-iss"
            hint="No Simples Nacional o ISS sai no DAS — use 0."
          >
            <Input
              id="fiscal-aliquota-iss"
              name="aliquotaIss"
              type="number"
              inputMode="decimal"
              placeholder="0"
              min="0"
              max="100"
              step="0.01"
              value={values.aliquotaIss}
              disabled={disabled}
              onChange={(e) => onChange("aliquotaIss", e.target.value)}
            />
          </FormItem>
        </FormGroup>
      )}
    </FormSection>
  );
}
