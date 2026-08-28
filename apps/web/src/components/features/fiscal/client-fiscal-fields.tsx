"use client";

import * as React from "react";
import { Receipt } from "lucide-react";
import { FormSection, FormGroup, FormItem } from "@/components/ui/form-components";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { maskCep, onlyDigits } from "@/lib/fiscal/cep";

/**
 * Endereço fiscal e indicador de IE do destinatário.
 *
 * Separado do campo `address` livre de propósito: aquele é uma string única,
 * boa para o dia a dia e inútil para a SEFAZ, que valida logradouro, número,
 * bairro, UF e — principalmente — o código IBGE do município. Dividir a string
 * existente daria erro em toda ambiguidade de vírgula.
 *
 * Recolhido por padrão e sem nenhum campo obrigatório: só a **NF-e** exige
 * endereço do destinatário, porque descreve a entrega de uma mercadoria. A
 * NFS-e se contenta com nome e documento.
 */

export interface ClientFiscalValues {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  codigoIbge: string;
  inscricaoEstadual: string;
  indicadorIe: string;
}

export const EMPTY_CLIENT_FISCAL: ClientFiscalValues = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  uf: "",
  codigoIbge: "",
  inscricaoEstadual: "",
  indicadorIe: "",
};

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
}

interface ClientFiscalFieldsProps {
  values: ClientFiscalValues;
  onChange: (values: ClientFiscalValues) => void;
  disabled?: boolean;
}

export function ClientFiscalFields({
  values,
  onChange,
  disabled,
}: ClientFiscalFieldsProps) {
  const [cepState, setCepState] = React.useState<"idle" | "loading" | "notFound">("idle");
  const lastLookup = React.useRef<string>("");

  const setField = (field: keyof ClientFiscalValues, value: string) =>
    onChange({ ...values, [field]: value });

  /**
   * O código IBGE não é digitável — vem daqui. É uma das rejeições mais comuns
   * quando falta, e não há como o usuário saber o número de cor.
   *
   * Dispara ao **completar 8 dígitos**, não no blur. O blur depende de o usuário
   * sair do campo — quem digita o CEP e vai direto no botão de salvar nunca o
   * aciona, e o endereço fica vazio sem nenhum sinal de que algo deveria ter
   * acontecido. `lastLookup` evita repetir a busca do mesmo CEP a cada tecla.
   */
  const lookupCep = React.useCallback(
    async (raw: string, current: ClientFiscalValues) => {
      const cep = onlyDigits(raw);
      if (cep.length !== 8 || cep === lastLookup.current) return;
      lastLookup.current = cep;
      setCepState("loading");
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = (await res.json()) as ViaCepResponse;
        if (data.erro) {
          setCepState("notFound");
          return;
        }
        setCepState("idle");
        // SOBRESCREVE, não completa. `data.x || current.x` parecia gentil — não
        // apagar o que o usuário digitou —, mas ao trocar de CEP deixava o
        // endereço anterior colado no novo: rua de um CEP, bairro de outro, e
        // o código IBGE possivelmente de um terceiro município. Um endereço
        // Frankenstein é pior que um campo vazio, e a SEFAZ valida o IBGE.
        //
        // Trocar o CEP é uma intenção clara de substituir o endereço inteiro.
        // Campo que o ViaCEP não devolve fica vazio para ser preenchido à mão —
        // é o caso dos CEPs gerais de cidade, que não têm logradouro.
        onChange({
          ...current,
          cep: maskCep(cep),
          logradouro: data.logradouro ?? "",
          bairro: data.bairro ?? "",
          municipio: data.localidade ?? "",
          uf: data.uf ?? "",
          codigoIbge: data.ibge ?? "",
        });
      } catch {
        // ViaCEP é auxiliar: falhar não pode travar o cadastro, mas o usuário
        // precisa saber que o preenchimento não veio.
        setCepState("notFound");
      }
    },
    [onChange],
  );

  return (
    <FormSection
      title="Dados fiscais"
      description="Necessários apenas para emitir nota de produto (NF-e). Nota de serviço não precisa."
      icon={Receipt}
      collapsible
      defaultOpen={false}
    >
      <div className="space-y-5">
        <FormGroup cols={2}>
          <FormItem
            label="CEP"
            htmlFor="cliente-cep"
            hint={
              cepState === "loading"
                ? "Buscando endereço…"
                : cepState === "notFound"
                  ? "CEP não encontrado — preencha o endereço à mão."
                  : "Preenche o resto do endereço."
            }
          >
            <Input
              id="cliente-cep"
              inputMode="numeric"
              placeholder="00000-000"
              maxLength={9}
              value={values.cep}
              disabled={disabled}
              onChange={(e) => {
                const masked = maskCep(e.target.value);
                const next = { ...values, cep: masked };
                onChange(next);
                void lookupCep(masked, next);
              }}
            />
          </FormItem>
          <FormItem label="Logradouro" htmlFor="cliente-logradouro">
            <Input
              id="cliente-logradouro"
              value={values.logradouro}
              disabled={disabled}
              onChange={(e) => setField("logradouro", e.target.value)}
            />
          </FormItem>
        </FormGroup>

        <FormGroup cols={2}>
          <FormItem label="Número" htmlFor="cliente-numero">
            <Input
              id="cliente-numero"
              value={values.numero}
              disabled={disabled}
              onChange={(e) => setField("numero", e.target.value)}
            />
          </FormItem>
          <FormItem label="Complemento" htmlFor="cliente-complemento">
            <Input
              id="cliente-complemento"
              value={values.complemento}
              disabled={disabled}
              onChange={(e) => setField("complemento", e.target.value)}
            />
          </FormItem>
        </FormGroup>

        <FormGroup cols={2}>
          <FormItem label="Bairro" htmlFor="cliente-bairro">
            <Input
              id="cliente-bairro"
              value={values.bairro}
              disabled={disabled}
              onChange={(e) => setField("bairro", e.target.value)}
            />
          </FormItem>
          <FormItem label="Município" htmlFor="cliente-municipio">
            <Input
              id="cliente-municipio"
              value={values.municipio}
              disabled={disabled}
              onChange={(e) => setField("municipio", e.target.value)}
            />
          </FormItem>
        </FormGroup>

        <FormGroup cols={2}>
          <FormItem label="UF" htmlFor="cliente-uf">
            <Input
              id="cliente-uf"
              maxLength={2}
              value={values.uf}
              disabled={disabled}
              onChange={(e) => setField("uf", e.target.value.toUpperCase())}
            />
          </FormItem>
          <FormItem
            label="Código IBGE do município"
            htmlFor="cliente-ibge"
            hint="Preenchido pela busca de CEP. A SEFAZ valida o município por ele."
          >
            <Input
              id="cliente-ibge"
              value={values.codigoIbge}
              disabled={disabled}
              onChange={(e) => setField("codigoIbge", onlyDigits(e.target.value))}
            />
          </FormItem>
        </FormGroup>

        <FormGroup cols={2}>
          <FormItem
            label="Indicador de inscrição estadual"
            htmlFor="cliente-indicador-ie"
            hint='Pessoa física é sempre "não contribuinte" — nunca "isento".'
          >
            <Select
              id="cliente-indicador-ie"
              value={values.indicadorIe}
              disabled={disabled}
              onChange={(e) => setField("indicadorIe", e.target.value)}
            >
              <option value="">Detectar automaticamente</option>
              <option value="nao_contribuinte">Não contribuinte</option>
              <option value="contribuinte">Contribuinte de ICMS</option>
              <option value="isento">Isento de inscrição estadual</option>
            </Select>
          </FormItem>
          <FormItem
            label="Inscrição estadual do cliente"
            htmlFor="cliente-ie"
            hint="Só para cliente marcado como contribuinte."
          >
            <Input
              id="cliente-ie"
              value={values.inscricaoEstadual}
              disabled={disabled}
              onChange={(e) => setField("inscricaoEstadual", e.target.value)}
            />
          </FormItem>
        </FormGroup>
      </div>
    </FormSection>
  );
}
