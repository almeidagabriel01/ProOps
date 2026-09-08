"use client";

import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormGroup, FormItem } from "@/components/ui/form-components";
import { StepNavigation } from "@/components/ui/step-wizard";
import { maskCep } from "@/lib/fiscal/cep";
import type { FiscalFormState } from "@/lib/fiscal/settings-payload";
import type { FiscalErrors, SetFiscalAddress } from "./types";

interface EnderecoStepProps {
  form: FiscalFormState;
  errors: FiscalErrors;
  setAddress: SetFiscalAddress;
  onCepBlur: () => void;
  onBeforeNext?: () => boolean;
  /**
   * Conta demo: o conteúdo do passo fica inerte, a navegação NÃO. O `inert`
   * vive aqui e não no `FormStepCard` porque este passo é um componente só —
   * o `contentDisabled` do card separa os filhos por posição (conteúdo, nav) e,
   * com um único filho, não isolaria nada.
   */
  contentDisabled?: boolean;
}

export function EnderecoStep({
  form,
  errors,
  setAddress,
  onCepBlur,
  onBeforeNext,
  contentDisabled,
}: EnderecoStepProps) {
  return (
    <>
      <div className="space-y-6" inert={contentDisabled || undefined}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Endereço do emitente</h3>
            <p className="text-sm text-muted-foreground">
              Preencha o CEP: o restante vem da consulta
            </p>
          </div>
        </div>

        <FormGroup>
          <FormItem
            label="CEP"
            htmlFor="fiscal-cep"
            required
            error={errors.cep}
          >
            <Input
              id="fiscal-cep"
              value={form.endereco.cep}
              onChange={(e) => setAddress("cep", maskCep(e.target.value))}
              onBlur={onCepBlur}
              inputMode="numeric"
              maxLength={9}
            />
          </FormItem>

          <FormItem
            label="Logradouro"
            htmlFor="fiscal-logradouro"
            required
            error={errors.logradouro}
          >
            <Input
              id="fiscal-logradouro"
              value={form.endereco.logradouro}
              onChange={(e) => setAddress("logradouro", e.target.value)}
            />
          </FormItem>
        </FormGroup>

        <FormGroup>
          <FormItem
            label="Número"
            htmlFor="fiscal-numero"
            required
            error={errors.numero}
          >
            <Input
              id="fiscal-numero"
              value={form.endereco.numero}
              onChange={(e) => setAddress("numero", e.target.value)}
            />
          </FormItem>

          <FormItem label="Complemento" htmlFor="fiscal-complemento">
            <Input
              id="fiscal-complemento"
              value={form.endereco.complemento ?? ""}
              onChange={(e) => setAddress("complemento", e.target.value)}
            />
          </FormItem>
        </FormGroup>

        <FormGroup>
          <FormItem
            label="Bairro"
            htmlFor="fiscal-bairro"
            required
            error={errors.bairro}
          >
            <Input
              id="fiscal-bairro"
              value={form.endereco.bairro}
              onChange={(e) => setAddress("bairro", e.target.value)}
            />
          </FormItem>

          <FormItem
            label="Município"
            htmlFor="fiscal-municipio"
            required
            error={errors.municipio}
          >
            <Input
              id="fiscal-municipio"
              value={form.endereco.municipio}
              onChange={(e) => setAddress("municipio", e.target.value)}
            />
          </FormItem>
        </FormGroup>

        <FormGroup>
          <FormItem label="UF" htmlFor="fiscal-uf" required error={errors.uf}>
            <Input
              id="fiscal-uf"
              value={form.endereco.uf}
              onChange={(e) =>
                setAddress("uf", e.target.value.toUpperCase().slice(0, 2))
              }
              maxLength={2}
            />
          </FormItem>

          <FormItem
            label="Código IBGE do município"
            htmlFor="fiscal-ibge"
            required
            error={errors.codigoIbge}
          >
            <Input
              id="fiscal-ibge"
              value={form.endereco.codigoIbge}
              onChange={(e) => setAddress("codigoIbge", e.target.value)}
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">
              Preenchido pela busca de CEP. A SEFAZ valida o município por este
              código.
            </p>
          </FormItem>
        </FormGroup>
      </div>

      <StepNavigation onBeforeNext={onBeforeNext} />
    </>
  );
}
