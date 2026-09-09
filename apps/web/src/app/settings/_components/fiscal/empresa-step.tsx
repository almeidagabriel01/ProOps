"use client";

import { Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Loader } from "@/components/ui/loader";
import { FormGroup, FormItem } from "@/components/ui/form-components";
import { StepNavigation } from "@/components/ui/step-wizard";
import type { FiscalFormState } from "@/lib/fiscal/settings-payload";
import type { FiscalTaxRegime } from "@/services/fiscal-service";
import type { FiscalErrors, SetFiscalField } from "./types";

interface EmpresaStepProps {
  form: FiscalFormState;
  errors: FiscalErrors;
  setField: SetFiscalField;
  maskCnpj: (value: string) => string;
  isLookingUp: boolean;
  onLookupCnpj: () => void;
  onBeforeNext?: () => boolean;
  /**
   * Conta demo: o conteúdo do passo fica inerte, a navegação NÃO. O `inert`
   * vive aqui e não no `FormStepCard` porque este passo é um componente só —
   * o `contentDisabled` do card separa os filhos por posição (conteúdo, nav) e,
   * com um único filho, não isolaria nada.
   */
  contentDisabled?: boolean;
}

export function EmpresaStep({
  form,
  errors,
  setField,
  maskCnpj,
  isLookingUp,
  onLookupCnpj,
  onBeforeNext,
  contentDisabled,
}: EmpresaStepProps) {
  const isSimples = form.regimeTributario === 1 || form.regimeTributario === 2;

  return (
    <>
      <div className="space-y-6" inert={contentDisabled || undefined}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary/15 to-primary/5 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Dados da empresa</h3>
            <p className="text-sm text-muted-foreground">
              Informe o CNPJ e busque: o resto é preenchido automaticamente
            </p>
          </div>
        </div>

        <FormItem
          label="CNPJ"
          htmlFor="fiscal-cnpj"
          required
          error={errors.cnpj}
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="fiscal-cnpj"
                value={form.cnpj}
                onChange={(e) => setField("cnpj", maskCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-12 shrink-0 rounded-xl"
              onClick={onLookupCnpj}
              disabled={isLookingUp}
            >
              {isLookingUp ? (
                <Loader size="sm" variant="button" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Buscar</span>
            </Button>
          </div>
        </FormItem>

        <FormItem
          label="Razão social"
          htmlFor="fiscal-razao"
          required
          error={errors.razaoSocial}
        >
          <Input
            id="fiscal-razao"
            value={form.razaoSocial}
            onChange={(e) => setField("razaoSocial", e.target.value)}
          />
        </FormItem>

        <FormGroup>
          <FormItem label="Nome fantasia" htmlFor="fiscal-fantasia">
            <Input
              id="fiscal-fantasia"
              value={form.nomeFantasia}
              onChange={(e) => setField("nomeFantasia", e.target.value)}
            />
          </FormItem>

          <FormItem
            label="E-mail fiscal"
            htmlFor="fiscal-email"
            required
            error={errors.email}
          >
            <Input
              id="fiscal-email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </FormItem>
        </FormGroup>

        <FormGroup>
          <FormItem label="Regime tributário" htmlFor="fiscal-regime" required>
            <Select
              id="fiscal-regime"
              value={String(form.regimeTributario)}
              onChange={(e) =>
                setField(
                  "regimeTributario",
                  Number(e.target.value) as FiscalTaxRegime,
                )
              }
            >
              <option value="1">Simples Nacional</option>
              <option value="2">Simples Nacional: excesso de sublimite</option>
              <option value="3">Regime Normal (Presumido ou Real)</option>
              <option value="4">MEI</option>
            </Select>
          </FormItem>

          <FormItem label="CNAE principal" htmlFor="fiscal-cnae">
            <Input
              id="fiscal-cnae"
              value={form.cnae}
              onChange={(e) => setField("cnae", e.target.value)}
            />
          </FormItem>
        </FormGroup>

        {/* Só para o Simples: `totTrib` é obrigatório na DPS e, para ME/EPP,
            o indicador de "não informar" é recusado (E0712) — sobra declarar
            a alíquota. Quem não é do Simples usa o indicador e não vê isto. */}
        {isSimples && (
          <FormItem
            label="Alíquota aproximada do Simples Nacional (%)"
            htmlFor="fiscal-percentual-sn"
          >
            <Input
              id="fiscal-percentual-sn"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              placeholder="6"
              value={form.percentualSimplesNacional}
              onChange={(e) =>
                setField("percentualSimplesNacional", e.target.value)
              }
            />
            <p className="text-xs text-muted-foreground">
              É a alíquota efetiva do seu DAS. Vai na nota de serviço como o
              total aproximado de tributos (Lei 12.741/2012).
            </p>
          </FormItem>
        )}
      </div>

      <StepNavigation onBeforeNext={onBeforeNext} />
    </>
  );
}
