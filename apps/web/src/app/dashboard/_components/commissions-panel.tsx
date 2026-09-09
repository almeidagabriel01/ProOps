"use client";

import * as React from "react";
import Link from "next/link";
import { Handshake, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/format";
import type { CommissionReport } from "@/services/transaction-service";

interface CommissionsPanelProps {
  report: CommissionReport | null;
}

const ROLE_LABEL = {
  vendedor: "Vendedor",
  arquiteto: "Arquiteto",
} as const;

/** Quantos parceiros cabem no cartão antes de virar "e mais N". */
const VISIBLE_PARTNERS = 4;

/**
 * "Quanto eu devo para cada arquiteto e para cada vendedor este mês."
 *
 * O painel some quando não há comissão nenhuma no mês, em vez de ocupar espaço
 * com zeros: a maioria dos tenants não usa comissionamento.
 */
export function CommissionsPanel({ report }: CommissionsPanelProps) {
  if (!report || report.partners.length === 0) return null;

  const visible = report.partners.slice(0, VISIBLE_PARTNERS);
  const remaining = report.partners.length - visible.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4 text-primary" />
          Comissões do mês
        </CardTitle>
        <Link
          href="/commissions"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Ver relatório
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">A pagar</span>
          <span className="font-mono text-xl font-semibold">
            {formatCurrency(report.aPagar)}
          </span>
        </div>

        <div className="space-y-2">
          {visible.map((partner) => (
            <div
              key={`${partner.contactId}-${partner.role ?? ""}`}
              className="flex items-center gap-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {partner.contactName || "Parceiro sem nome"}
              </span>
              {partner.role && (
                <Badge variant="outline" className="shrink-0">
                  {ROLE_LABEL[partner.role]}
                </Badge>
              )}
              <span className="shrink-0 font-mono text-sm">
                {formatCurrency(partner.aPagar)}
              </span>
            </div>
          ))}
        </div>

        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            e mais {remaining} {remaining === 1 ? "parceiro" : "parceiros"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
