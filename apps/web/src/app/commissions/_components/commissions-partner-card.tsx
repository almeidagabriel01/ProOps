"use client";

import * as React from "react";
import { ChevronDown, Handshake, DraftingCompass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";
import type { CommissionReportPartner } from "@/services/transaction-service";

interface CommissionsPartnerCardProps {
  partner: CommissionReportPartner;
  canEdit: boolean;
  payingId: string | null;
  onTogglePaid: (transactionId: string, paid: boolean) => void;
}

const ROLE_LABEL = {
  vendedor: "Vendedor",
  arquiteto: "Arquiteto",
} as const;

/**
 * Uma linha por parceiro, expandindo nas parcelas do mês.
 *
 * "A pagar" soma tudo que não está pago, vencido incluído: `overdue` é derivado
 * e continua sendo dinheiro devido ao parceiro.
 */
export function CommissionsPartnerCard({
  partner,
  canEdit,
  payingId,
  onTogglePaid,
}: CommissionsPartnerCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const RoleIcon = partner.role === "arquiteto" ? DraftingCompass : Handshake;

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <RoleIcon className="h-5 w-5 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {partner.contactName || "Parceiro sem nome"}
          </p>
          {partner.role && (
            <Badge variant="outline" className="mt-1">
              {ROLE_LABEL[partner.role]}
            </Badge>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono font-semibold">
            {formatCurrency(partner.aPagar)}
          </p>
          <p className="text-xs text-muted-foreground">
            a pagar
            {partner.pago > 0 && ` · ${formatCurrency(partner.pago)} pago`}
          </p>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div className="border-t px-4 py-2">
          {partner.entries.map((entry) => {
            const isPaid = entry.status === "paid";
            const isBusy = payingId === entry.transactionId;
            return (
              <div
                key={entry.transactionId}
                className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Vence {formatDateBR(entry.dueDate, "")}
                    {entry.installmentNumber && entry.installmentCount
                      ? ` · parcela ${entry.installmentNumber}/${entry.installmentCount}`
                      : ""}
                  </p>
                </div>

                <span className="font-mono text-sm sm:w-32 sm:text-right">
                  {formatCurrency(entry.amount)}
                </span>

                <div className="sm:w-36 sm:text-right">
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={isPaid ? "outline" : "default"}
                      disabled={isBusy}
                      onClick={() =>
                        onTogglePaid(entry.transactionId, !isPaid)
                      }
                    >
                      {isBusy && (
                        <Loader size="sm" variant="button" className="mr-2" />
                      )}
                      {isPaid ? "Marcar pendente" : "Marcar paga"}
                    </Button>
                  ) : (
                    <Badge variant={isPaid ? "success" : "outline"}>
                      {isPaid ? "Paga" : "Pendente"}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
