"use client";

import * as React from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  hasTaxEdits,
  taxesFormFromView,
  UNTOUCHED_TAXES,
  type LineTaxesForm,
} from "@/lib/fiscal/nfe-form";
import { lineTaxSummary } from "@/lib/fiscal/line-tax-summary";
import type { IcmsKind } from "@/lib/fiscal/tax-codes";
import type { FiscalNfeLineView } from "@/services/fiscal-service";
import { IcmsFields } from "./icms-fields";
import { IpiFields } from "./ipi-fields";
import { PisCofinsFields } from "./pis-cofins-fields";

interface LineTaxesPanelProps {
  id: string;
  value: LineTaxesForm;
  onChange: (value: LineTaxesForm) => void;
  /** A linha como a prévia devolveu: o que vale enquanto a pessoa não mexe. */
  preview?: FiscalNfeLineView;
  icmsKind: IcmsKind;
  disabled?: boolean;
}

/**
 * Os impostos de uma linha: ICMS, IPI, PIS e COFINS. Recolhido, com o resumo
 * do que a prévia aplicou (o padrão do contato ou o da operação). Mexer num
 * imposto fixa só aquele; "Voltar ao padrão" devolve os quatro à prévia.
 */
export function LineTaxesPanel({ id, value, onChange, preview, icmsKind, disabled }: LineTaxesPanelProps) {
  const [open, setOpen] = React.useState(false);
  const fromView = taxesFormFromView(preview);
  const editado = hasTaxEdits(value);
  const bloqueado = disabled || !preview;

  return (
    <div className="rounded-lg border border-dashed">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={`${id}-impostos`}
      >
        <span className="min-w-0">
          <span className="font-medium">Impostos</span>
          <span className="ml-2 text-muted-foreground">{lineTaxSummary(preview)}</span>
          {editado && <span className="ml-2 text-xs text-primary">editados nesta nota</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={`${id}-impostos`} className="flex flex-col gap-4 border-t px-3 py-3">
          {!preview && (
            <p className="text-sm text-muted-foreground">
              Os impostos aparecem quando a prévia da nota estiver pronta (escolha o destinatário).
            </p>
          )}
          <section className="flex flex-col gap-2" aria-label="ICMS">
            <h4 className="text-sm font-semibold">ICMS</h4>
            <IcmsFields
              id={id}
              icmsKind={icmsKind}
              value={value.icms ?? fromView.icms}
              calculado={preview?.icms}
              disabled={bloqueado}
              onChange={(icms) => onChange({ ...value, icms })}
            />
          </section>
          <section className="flex flex-col gap-2" aria-label="IPI">
            <h4 className="text-sm font-semibold">IPI</h4>
            <IpiFields
              id={id}
              value={value.ipi ?? fromView.ipi}
              disabled={bloqueado}
              onChange={(ipi) => onChange({ ...value, ipi })}
            />
          </section>
          <section className="flex flex-col gap-2" aria-label="PIS e COFINS">
            <h4 className="text-sm font-semibold">PIS e COFINS</h4>
            <PisCofinsFields
              id={id}
              rotulo="PIS"
              value={value.pis ?? fromView.pis}
              calculado={preview?.pis}
              disabled={bloqueado}
              onChange={(pis) => onChange({ ...value, pis })}
            />
            <PisCofinsFields
              id={id}
              rotulo="COFINS"
              value={value.cofins ?? fromView.cofins}
              calculado={preview?.cofins}
              disabled={bloqueado}
              onChange={(cofins) => onChange({ ...value, cofins })}
            />
          </section>
          {editado && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={disabled}
              onClick={() => onChange(UNTOUCHED_TAXES)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Voltar ao padrão
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
