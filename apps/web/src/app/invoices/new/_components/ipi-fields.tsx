"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { decimalInput, IPI_CST_OPCOES, IPI_CST_TRIBUTADOS, type IpiForm } from "@/lib/fiscal/nfe-form";
import { Field } from "./field";

interface IpiFieldsProps {
  id: string;
  value: IpiForm;
  onChange: (value: IpiForm) => void;
  disabled?: boolean;
}

/** IPI de uma linha. Quase nenhuma nota leva: o padrão é "sem IPI". */
export function IpiFields({ id, value, onChange, disabled }: IpiFieldsProps) {
  const tributado = IPI_CST_TRIBUTADOS.has(value.cst);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <Field label="Alíquota do IPI (%)" htmlFor={`${id}-ipi-aliquota`}>
          <Input
            id={`${id}-ipi-aliquota`}
            inputMode="decimal"
            placeholder="0"
            value={value.aliquota}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, aliquota: decimalInput(e.target.value) })}
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
  );
}
