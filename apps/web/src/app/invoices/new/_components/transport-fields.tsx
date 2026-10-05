"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  MODALIDADES_FRETE,
  transportadoraDocumentoValido,
  type ModalidadeFrete,
  type TransporteForm,
} from "@/lib/fiscal/nfe-form";
import { Field } from "./field";

interface TransportFieldsProps {
  value: TransporteForm;
  onChange: (value: TransporteForm) => void;
  disabled?: boolean;
}

/** Frete, transportadora, volumes e peso: o bloco de transporte do DANFE. */
export function TransportFields({ value, onChange, disabled }: TransportFieldsProps) {
  const set = <K extends keyof TransporteForm>(key: K, next: TransporteForm[K]) =>
    onChange({ ...value, [key]: next });
  const documentoInvalido = !transportadoraDocumentoValido(value.transportadoraDocumento);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Frete" htmlFor="nfe-frete">
        <Select
          id="nfe-frete"
          value={String(value.modalidadeFrete)}
          disabled={disabled}
          disableSort
          onChange={(e) => set("modalidadeFrete", Number(e.target.value) as ModalidadeFrete)}
        >
          {MODALIDADES_FRETE.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Transportadora" htmlFor="nfe-transp-nome" className="sm:col-span-2">
          <Input
            id="nfe-transp-nome"
            placeholder="Razão social"
            value={value.transportadoraNome}
            disabled={disabled}
            onChange={(e) => set("transportadoraNome", e.target.value)}
          />
        </Field>
        <Field
          label="CNPJ ou CPF da transportadora"
          htmlFor="nfe-transp-doc"
          hint={documentoInvalido ? "Documento incompleto." : undefined}
          invalid={documentoInvalido}
        >
          <Input
            id="nfe-transp-doc"
            inputMode="numeric"
            value={value.transportadoraDocumento}
            disabled={disabled}
            aria-invalid={documentoInvalido}
            onChange={(e) => set("transportadoraDocumento", e.target.value)}
          />
        </Field>
        <Field label="Inscrição estadual" htmlFor="nfe-transp-ie">
          <Input
            id="nfe-transp-ie"
            value={value.transportadoraIe}
            disabled={disabled}
            onChange={(e) => set("transportadoraIe", e.target.value)}
          />
        </Field>
        <Field label="Endereço" htmlFor="nfe-transp-end" className="sm:col-span-2">
          <Input
            id="nfe-transp-end"
            value={value.transportadoraEndereco}
            disabled={disabled}
            onChange={(e) => set("transportadoraEndereco", e.target.value)}
          />
        </Field>
        <Field label="Município" htmlFor="nfe-transp-mun">
          <Input
            id="nfe-transp-mun"
            value={value.transportadoraMunicipio}
            disabled={disabled}
            onChange={(e) => set("transportadoraMunicipio", e.target.value)}
          />
        </Field>
        <Field label="UF" htmlFor="nfe-transp-uf">
          <Input
            id="nfe-transp-uf"
            maxLength={2}
            value={value.transportadoraUf}
            disabled={disabled}
            onChange={(e) => set("transportadoraUf", e.target.value.toUpperCase())}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Volumes" htmlFor="nfe-vol-qtd">
          <Input
            id="nfe-vol-qtd"
            inputMode="numeric"
            placeholder="1"
            value={value.volumeQuantidade}
            disabled={disabled}
            onChange={(e) => set("volumeQuantidade", e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Espécie" htmlFor="nfe-vol-esp">
          <Input
            id="nfe-vol-esp"
            placeholder="Caixa"
            value={value.volumeEspecie}
            disabled={disabled}
            onChange={(e) => set("volumeEspecie", e.target.value)}
          />
        </Field>
        <Field label="Peso bruto (kg)" htmlFor="nfe-peso-bruto">
          <Input
            id="nfe-peso-bruto"
            inputMode="decimal"
            placeholder="0,000"
            value={value.pesoBruto}
            disabled={disabled}
            onChange={(e) => set("pesoBruto", e.target.value)}
          />
        </Field>
        <Field label="Peso líquido (kg)" htmlFor="nfe-peso-liquido">
          <Input
            id="nfe-peso-liquido"
            inputMode="decimal"
            placeholder="0,000"
            value={value.pesoLiquido}
            disabled={disabled}
            onChange={(e) => set("pesoLiquido", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
