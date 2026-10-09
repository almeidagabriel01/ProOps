"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/utils/format";
import { decimalInput, type IcmsForm } from "@/lib/fiscal/nfe-form";
import {
  codigoLabel,
  findIcmsSituacao,
  ICMS_SITUACOES,
  type IcmsKind,
} from "@/lib/fiscal/tax-codes";
import type { FiscalIcms } from "@/services/fiscal-service";
import { Field } from "./field";

interface IcmsFieldsProps {
  id: string;
  value: IcmsForm;
  onChange: (value: IcmsForm) => void;
  /** CSOSN no Simples, CST no Regime Normal: vem da prévia. */
  icmsKind: IcmsKind;
  /** O que a prévia calculou, para os campos de valor em branco. */
  calculado?: FiscalIcms;
  disabled?: boolean;
}

function placeholderDe(valor: number | undefined): string {
  return valor === undefined ? "Calculado" : formatCurrency(valor);
}

/**
 * ICMS de uma linha. Os campos aparecem conforme o código: o 101 pede o
 * crédito, o 900 aceita destacar o imposto (base menor que o valor do
 * produto, alíquota, valor) e o crédito. Base e valores em branco são
 * calculados pelo backend, e o placeholder mostra o número.
 */
export function IcmsFields({ id, value, onChange, icmsKind, calculado, disabled }: IcmsFieldsProps) {
  const opcoes = ICMS_SITUACOES.filter((item) => item.kind === icmsKind);
  const def = findIcmsSituacao(value.situacao);
  const destaque = def?.destaque ?? "nenhum";
  const credito = def?.credito ?? "nenhum";
  // O número da prévia só vale como placeholder se ela já usou este código.
  const prevista = calculado?.situacao === value.situacao ? calculado : undefined;
  const set = (patch: Partial<IcmsForm>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <Field
        label={icmsKind === "csosn" ? "Situação do ICMS (CSOSN)" : "Situação do ICMS (CST)"}
        htmlFor={`${id}-icms-situacao`}
        className="sm:col-span-4"
      >
        <Select
          id={`${id}-icms-situacao`}
          value={value.situacao}
          disabled={disabled}
          disableSort
          onChange={(e) => set({ situacao: e.target.value })}
        >
          {/* Código que veio do cadastro do produto e não está na lista. */}
          {value.situacao && !def && <option value={value.situacao}>{value.situacao}</option>}
          {opcoes.map((opcao) => (
            <option key={opcao.codigo} value={opcao.codigo}>
              {codigoLabel(opcao)}
            </option>
          ))}
        </Select>
      </Field>

      {destaque !== "nenhum" && (
        <>
          {(destaque === "reducao" || destaque === "opcional") && (
            <Field label="Redução da base (%)" htmlFor={`${id}-icms-reducao`}>
              <Input
                id={`${id}-icms-reducao`}
                inputMode="decimal"
                placeholder="0"
                value={value.reducaoBase}
                disabled={disabled}
                onChange={(e) => set({ reducaoBase: decimalInput(e.target.value) })}
              />
            </Field>
          )}
          <Field label="Base do ICMS" htmlFor={`${id}-icms-base`}>
            <Input
              id={`${id}-icms-base`}
              inputMode="decimal"
              placeholder={placeholderDe(prevista?.baseCalculo)}
              value={value.baseCalculo}
              disabled={disabled}
              onChange={(e) => set({ baseCalculo: decimalInput(e.target.value) })}
            />
          </Field>
          <Field label="Alíquota do ICMS (%)" htmlFor={`${id}-icms-aliquota`}>
            <Input
              id={`${id}-icms-aliquota`}
              inputMode="decimal"
              placeholder="0"
              value={value.aliquota}
              disabled={disabled}
              onChange={(e) => set({ aliquota: decimalInput(e.target.value) })}
            />
          </Field>
          <Field label="Valor do ICMS" htmlFor={`${id}-icms-valor`}>
            <Input
              id={`${id}-icms-valor`}
              inputMode="decimal"
              placeholder={placeholderDe(prevista?.valor)}
              value={value.valor}
              disabled={disabled}
              onChange={(e) => set({ valor: decimalInput(e.target.value) })}
            />
          </Field>
        </>
      )}

      {credito !== "nenhum" && (
        <>
          <Field
            label="Crédito do Simples (%)"
            htmlFor={`${id}-icms-credito`}
            className="sm:col-span-2"
            hint={
              credito === "obrigatorio"
                ? "Em branco: a alíquota das configurações fiscais."
                : "Só se este cliente aproveita crédito nesta nota."
            }
          >
            <Input
              id={`${id}-icms-credito`}
              inputMode="decimal"
              placeholder={prevista?.aliquotaCredito !== undefined ? String(prevista.aliquotaCredito).replace(".", ",") : "0"}
              value={value.aliquotaCredito}
              disabled={disabled}
              onChange={(e) => set({ aliquotaCredito: decimalInput(e.target.value) })}
            />
          </Field>
          <Field label="Valor do crédito" htmlFor={`${id}-icms-valor-credito`} className="sm:col-span-2">
            <Input
              id={`${id}-icms-valor-credito`}
              inputMode="decimal"
              placeholder={placeholderDe(prevista?.valorCredito)}
              value={value.valorCredito}
              disabled={disabled}
              onChange={(e) => set({ valorCredito: decimalInput(e.target.value) })}
            />
          </Field>
        </>
      )}
    </div>
  );
}
