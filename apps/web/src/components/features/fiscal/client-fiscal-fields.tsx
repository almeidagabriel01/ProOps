"use client";

import * as React from "react";
import { Receipt } from "lucide-react";
import {
  FormSection,
  FormGroup,
  FormItem,
} from "@/components/ui/form-components";
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
  /**
   * `section` (padrão) — card recolhível. `step` — conteúdo de um passo do
   * `StepWizard`: cabeçalho no padrão dos outros passos e campos sempre
   * visíveis. Recolher aqui recriaria o problema que o passo resolveu: fechado,
   * ninguém achava o endereço fiscal, que é o que a NF-e exige do destinatário.
   */
  variant?: "section" | "step";
}

/**
 * Uma descrição só, porque nos dois layouts o endereço livre está logo ACIMA:
 * na seção, no formulário que a contém; no passo, no mesmo card, logo antes
 * destes campos. Enquanto o bloco fiscal era um passo separado do de endereço,
 * a instrução precisava dizer "passo anterior" para não apontar para o vazio.
 */
const DESCRIPTION =
  "Necessários apenas para emitir nota de produto (NF-e). Preenchendo aqui, o endereço acima é completado sozinho.";

export function ClientFiscalFields({
  values,
  onChange,
  disabled,
  variant = "section",
}: ClientFiscalFieldsProps) {
  const [cepState, setCepState] = React.useState<
    "idle" | "loading" | "notFound"
  >("idle");
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
          // Número e complemento também são do endereço ANTIGO. O ViaCEP não os
          // devolve, então eram os únicos que sobreviviam à troca — e um número
          // de outra rua é pior que nenhum, porque parece preenchido.
          numero: "",
          complemento: "",
        });
      } catch {
        // ViaCEP é auxiliar: falhar não pode travar o cadastro, mas o usuário
        // precisa saber que o preenchimento não veio.
        setCepState("notFound");
      }
    },
    [onChange],
  );

  const fields = (
    <div className="space-y-5">
      <FormGroup cols={2}>
        <FormItem label="CEP" htmlFor="cliente-cep">
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
          <p
            className={
              cepState === "notFound"
                ? "text-xs text-amber-600"
                : "text-xs text-muted-foreground"
            }
          >
            {cepState === "loading"
              ? "Buscando endereço…"
              : cepState === "notFound"
                ? "CEP não encontrado: preencha o endereço à mão."
                : "Preenche o resto do endereço."}
          </p>
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
        <FormItem label="Código IBGE do município" htmlFor="cliente-ibge">
          <Input
            id="cliente-ibge"
            value={values.codigoIbge}
            disabled={disabled}
            onChange={(e) => setField("codigoIbge", onlyDigits(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Preenchido pela busca de CEP. A SEFAZ valida o município por ele.
          </p>
        </FormItem>
      </FormGroup>

      <FormGroup cols={2}>
        <FormItem
          label="Indicador de inscrição estadual"
          htmlFor="cliente-indicador-ie"
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
          <p className="text-xs text-muted-foreground">
            Pessoa física é sempre &quot;não contribuinte&quot;, nunca
            &quot;isento&quot;.
          </p>
        </FormItem>
        <FormItem label="Inscrição estadual do cliente" htmlFor="cliente-ie">
          <Input
            id="cliente-ie"
            value={values.inscricaoEstadual}
            disabled={disabled}
            onChange={(e) => setField("inscricaoEstadual", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Só para cliente marcado como contribuinte.
          </p>
        </FormItem>
      </FormGroup>
    </div>
  );

  if (variant === "step") {
    return (
      <>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500/15 to-emerald-500/5 flex items-center justify-center">
            <Receipt className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Dados fiscais</h3>
            <p className="text-sm text-muted-foreground">{DESCRIPTION}</p>
          </div>
        </div>
        {fields}
      </>
    );
  }

  return (
    <FormSection
      title="Dados fiscais"
      description={DESCRIPTION}
      icon={Receipt}
      collapsible
      defaultOpen={false}
    >
      {fields}
    </FormSection>
  );
}
