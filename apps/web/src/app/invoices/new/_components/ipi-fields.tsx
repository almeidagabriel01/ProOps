"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { IPI_CST_OPCOES, IPI_CST_TRIBUTADOS, type IpiForm } from "@/lib/fiscal/nfe-form";
import { Field } from "./field";

interface IpiFieldsProps {
  id: string;
  value: IpiForm;
  onChange: (value: IpiForm) => void;
  /** O valor que a prévia calculou, para o resumo fechado. */
  valorIpi?: number;
  disabled?: boolean;
}

/**
 * IPI de uma linha. Recolhido: quase nenhuma nota leva IPI, e o resumo
 * fechado já diz se esta linha leva e quanto.
 */
export function IpiFields({ id, value, onChange, valorIpi, disabled }: IpiFieldsProps) {
  const [open, setOpen] = React.useState(false);
  const tributado = IPI_CST_TRIBUTADOS.has(value.cst);

  const resumo = !value.cst
    ? "Sem IPI"
    : tributado
      ? `IPI ${value.aliquota || "0"}%${valorIpi ? `: ${formatCurrency(valorIpi)}` : ""}`
      : `IPI, CST ${value.cst}`;

  return (
    <div className="rounded-lg border border-dashed">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={`${id}-ipi`}
      >
        <span className={value.cst ? "font-medium" : "text-muted-foreground"}>{resumo}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div id={`${id}-ipi`} className="grid grid-cols-1 gap-3 border-t px-3 py-3 sm:grid-cols-3">
          <Field label="Situação do IPI (CST)" htmlFor={`${id}-ipi-cst`} className="sm:col-span-3">
            <Select
              id={`${id}-ipi-cst`}
              value={value.cst}
              disabled={disabled}
              disableSort
              onChange={(e) => onChange({ ...value, cst: e.target.value })}
            >
              <option value="">Sem IPI nesta linha</option>
              {IPI_CST_OPCOES.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </Select>
          </Field>
          {tributado && (
            <Field label="Alíquota (%)" htmlFor={`${id}-ipi-aliquota`}>
              <Input
                id={`${id}-ipi-aliquota`}
                inputMode="decimal"
                placeholder="0"
                value={value.aliquota}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, aliquota: e.target.value })}
              />
            </Field>
          )}
          {value.cst && (
            <Field
              label="Enquadramento"
              htmlFor={`${id}-ipi-enq`}
              hint="Em branco: 999, sem enquadramento específico."
              className={tributado ? "sm:col-span-2" : "sm:col-span-3"}
            >
              <Input
                id={`${id}-ipi-enq`}
                inputMode="numeric"
                maxLength={3}
                placeholder="999"
                value={value.codigoEnquadramento}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...value, codigoEnquadramento: e.target.value.replace(/\D/g, "") })
                }
              />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}
