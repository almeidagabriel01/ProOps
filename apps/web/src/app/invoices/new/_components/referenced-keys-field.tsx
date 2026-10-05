"use client";

import * as React from "react";
import { FileInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/utils/format";
import { parseChaves } from "@/lib/fiscal/nfe-form";
import {
  ReceivedInvoiceService,
  type ReceivedInvoice,
} from "@/services/received-invoice-service";
import { Field } from "./field";

interface ReferencedKeysFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Devolução: a SEFAZ recusa sem a chave. */
  required: boolean;
  /** Só com a recepção de notas no plano (Enterprise). */
  canPickReceived: boolean;
  /** Escolher uma recebida também oferece os itens dela. */
  onPickReceived?: (invoice: ReceivedInvoice) => void;
  disabled?: boolean;
}

/**
 * Chave da nota de origem (devolução, retorno), digitada ou escolhida nas
 * notas recebidas. Digitar é o caminho de sempre: quem emite a remessa tem o
 * DANFE na mão e não quer depender do XML de entrada.
 */
export function ReferencedKeysField({
  value,
  onChange,
  required,
  canPickReceived,
  onPickReceived,
  disabled,
}: ReferencedKeysFieldProps) {
  const [picking, setPicking] = React.useState(false);
  const [received, setReceived] = React.useState<ReceivedInvoice[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const { invalidas } = parseChaves(value);

  React.useEffect(() => {
    if (!picking || received !== null) return;
    let cancelled = false;
    ReceivedInvoiceService.list({ limit: 50 })
      .then(({ invoices }) => {
        if (!cancelled) setReceived(invoices.filter((inv) => inv.status !== "cancelada"));
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setReceived([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [picking, received]);

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

      {canPickReceived && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={disabled}
            onClick={() => setPicking((prev) => !prev)}
          >
            <FileInput className="mr-2 h-4 w-4" />
            Escolher nas notas recebidas
          </Button>
          {picking && (
            <div className="max-h-56 overflow-y-auto rounded-lg border">
              {received === null ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader size="sm" /> Carregando as notas recebidas
                </div>
              ) : received.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  {loadError
                    ? "Não foi possível carregar as notas recebidas."
                    : "Nenhuma nota recebida. A recepção é ligada em Configuração fiscal."}
                </p>
              ) : (
                <ul className="divide-y">
                  {received.map((inv) => (
                    <li key={inv.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/60"
                        onClick={() => {
                          const atuais = parseChaves(value).chaves;
                          if (!atuais.includes(inv.chaveAcesso)) {
                            onChange([...atuais, inv.chaveAcesso].join("\n"));
                          }
                          onPickReceived?.(inv);
                          setPicking(false);
                        }}
                      >
                        <span className="font-medium">
                          {inv.emitenteNome || inv.emitenteCnpj}
                          {inv.numero ? `, nº ${inv.numero}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(inv.valorTotal)}
                          {inv.dataEmissao
                            ? `, emitida em ${new Date(inv.dataEmissao).toLocaleDateString("pt-BR")}`
                            : ""}
                          {inv.itens?.length ? `, ${inv.itens.length} itens` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
