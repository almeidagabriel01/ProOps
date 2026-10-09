"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/utils/format";
import { decimalInput, type PisCofinsForm } from "@/lib/fiscal/nfe-form";
import { codigoLabel, findPisCofinsCst, PIS_COFINS_CSTS } from "@/lib/fiscal/tax-codes";
import type { FiscalPisCofins } from "@/services/fiscal-service";
import { Field } from "./field";

interface PisCofinsFieldsProps {
  id: string;
  rotulo: "PIS" | "COFINS";
  value: PisCofinsForm;
  onChange: (value: PisCofinsForm) => void;
  /** O que a prévia calculou, para os campos de valor em branco. */
  calculado?: FiscalPisCofins;
  disabled?: boolean;
}

/**
 * PIS ou COFINS de uma linha. No Simples o padrão é 99 zerado (o recolhimento
 * é no DAS); o cliente que pede o destaque escolhe o CST e a alíquota aqui.
 */
export function PisCofinsFields({ id, rotulo, value, onChange, calculado, disabled }: PisCofinsFieldsProps) {
  const grupo = findPisCofinsCst(value.cst)?.grupo ?? "outros";
  const prevista = calculado?.cst === value.cst ? calculado : undefined;
  const prefixo = `${id}-${rotulo.toLowerCase()}`;
  const de = rotulo === "PIS" ? "do PIS" : "da COFINS";
  const set = (patch: Partial<PisCofinsForm>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <Field label={`CST ${de}`} htmlFor={`${prefixo}-cst`} className="sm:col-span-4">
        <Select
          id={`${prefixo}-cst`}
          value={value.cst}
          disabled={disabled}
          disableSort
          onChange={(e) => set({ cst: e.target.value })}
        >
          {PIS_COFINS_CSTS.map((opcao) => (
            <option key={opcao.codigo} value={opcao.codigo}>
              {codigoLabel(opcao)}
            </option>
          ))}
        </Select>
      </Field>
      {grupo !== "nao_tributado" && (
        <>
          <Field label={`Base ${de}`} htmlFor={`${prefixo}-base`} className="sm:col-span-2">
            <Input
              id={`${prefixo}-base`}
              inputMode="decimal"
              placeholder={prevista?.baseCalculo !== undefined ? formatCurrency(prevista.baseCalculo) : "Calculada"}
              value={value.baseCalculo}
              disabled={disabled}
              onChange={(e) => set({ baseCalculo: decimalInput(e.target.value) })}
            />
          </Field>
          <Field label={`Alíquota ${de} (%)`} htmlFor={`${prefixo}-aliquota`}>
            <Input
              id={`${prefixo}-aliquota`}
              inputMode="decimal"
              placeholder="0"
              value={value.aliquota}
              disabled={disabled}
              onChange={(e) => set({ aliquota: decimalInput(e.target.value) })}
            />
          </Field>
          <Field label={`Valor ${de}`} htmlFor={`${prefixo}-valor`}>
            <Input
              id={`${prefixo}-valor`}
              inputMode="decimal"
              placeholder={prevista?.valor !== undefined ? formatCurrency(prevista.valor) : "Calculado"}
              value={value.valor}
              disabled={disabled}
              onChange={(e) => set({ valor: decimalInput(e.target.value) })}
            />
          </Field>
        </>
      )}
    </div>
  );
}
