"use client";

import * as React from "react";
import { CheckCircle2, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { FormGroup, FormItem } from "@/components/ui/form-components";
import { StepNavigation } from "@/components/ui/step-wizard";
import type { FiscalFormState } from "@/lib/fiscal/settings-payload";
import type { SetFiscalField } from "./types";

interface CertificadoStepProps {
  form: FiscalFormState;
  setField: SetFiscalField;
  certificadoArmazenado: boolean;
  /** Lida do próprio `.pfx` pelo provedor — nunca digitada. */
  certificadoValidade?: string;
  isUploading: boolean;
  onUpload: (file: File) => void;
  isSaving: boolean;
  onSave: () => void;
  submitDisabled?: boolean;
  /**
   * Conta demo: o conteúdo do passo fica inerte, a navegação NÃO. O `inert`
   * vive aqui e não no `FormStepCard` porque este passo é um componente só —
   * o `contentDisabled` do card separa os filhos por posição (conteúdo, nav) e,
   * com um único filho, não isolaria nada.
   */
  contentDisabled?: boolean;
}

export function CertificadoStep({
  form,
  setField,
  certificadoArmazenado,
  certificadoValidade,
  isUploading,
  onUpload,
  isSaving,
  onSave,
  submitDisabled,
  contentDisabled,
}: CertificadoStepProps) {
  const certificateInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="space-y-6" inert={contentDisabled || undefined}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500/15 to-emerald-500/5 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Certificado digital</h3>
            <p className="text-sm text-muted-foreground">
              e-CNPJ modelo A1 (arquivo .pfx)
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          O arquivo não fica guardado na ProOps: é enviado ao provedor fiscal,
          que o custodia. Enviar o certificado também salva a configuração dos
          passos anteriores.
        </p>

        {certificadoArmazenado && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Certificado registrado no provedor.</span>
          </div>
        )}

        <FormGroup>
          <FormItem label="Senha do certificado" htmlFor="fiscal-cert-senha">
            <Input
              id="fiscal-cert-senha"
              type="password"
              value={form.certificadoSenha}
              onChange={(e) => setField("certificadoSenha", e.target.value)}
              autoComplete="off"
            />
          </FormItem>

          {/* Lida do próprio arquivo ao enviar — pedir para digitar
              arriscaria uma data errada, e o alerta avisaria no dia errado. */}
          <FormItem label="Validade do certificado">
            <div className="flex h-12 items-center rounded-xl border border-border/30 bg-muted/40 px-4 text-sm">
              {certificadoValidade ? (
                new Date(certificadoValidade).toLocaleDateString("pt-BR")
              ) : (
                <span className="text-muted-foreground/60">
                  Detectada ao enviar o certificado
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Avisamos com 30, 15, 7 e 1 dia de antecedência.
            </p>
          </FormItem>
        </FormGroup>

        <input
          ref={certificateInputRef}
          type="file"
          accept=".pfx,.p12"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => certificateInputRef.current?.click()}
          disabled={isUploading}
          className="h-12 self-start rounded-xl"
        >
          {isUploading ? (
            <Loader size="sm" variant="button" className="mr-2" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Enviar certificado .pfx
        </Button>
      </div>

      <StepNavigation
        onSubmit={onSave}
        isSubmitting={isSaving}
        submitDisabled={submitDisabled}
        submitLabel="Salvar configuração"
      />
    </>
  );
}
