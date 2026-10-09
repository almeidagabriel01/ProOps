"use client";

import * as React from "react";
import { FileInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseChaves } from "@/lib/fiscal/nfe-form";
import { Field } from "./field";

interface ReferencedKeysFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Devolução: a SEFAZ recusa sem a chave. */
  required: boolean;
  /** Abre a nota de origem (XML ou recebidas), que preenche a chave. */
  onOpenSource: () => void;
  disabled?: boolean;
}

/**
 * Chave da nota de origem (devolução, remessa, retorno), digitada ou trazida
 * da própria nota. Digitar continua valendo: quem emite a remessa tem o DANFE
 * na mão e não quer depender do XML de entrada.
 */
export function ReferencedKeysField({
  value,
  onChange,
  required,
  onOpenSource,
  disabled,
}: ReferencedKeysFieldProps) {
  const { invalidas } = parseChaves(value);

  return (
    <div className="flex flex-col gap-2">
      <Field
        label={required ? "Chave da nota devolvida" : "Chave da nota de origem (opcional)"}
        htmlFor="nfe-chaves"
        invalid={invalidas.length > 0}
        hint={
          invalidas.length > 0
            ? "A chave de acesso tem 44 dígitos. Confira a que está incompleta."
            : "Os 44 dígitos da chave de acesso, como estão no DANFE. Uma por linha."
        }
      >
        <Textarea
          id="nfe-chaves"
          className="min-h-[72px] font-mono"
          value={value}
          disabled={disabled}
          aria-invalid={invalidas.length > 0}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={disabled}
        onClick={onOpenSource}
      >
        <FileInput className="mr-2 h-4 w-4" />
        Trazer da nota de origem
      </Button>
    </div>
  );
}
