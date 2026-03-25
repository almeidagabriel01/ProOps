"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { Transaction } from "@/services/transaction-service";
import { formatDateBR } from "@/utils/date-format";

interface InstallmentsCardProps {
  installments: Transaction[];
  currentTransactionId?: string;
  disableLinks?: boolean;
}

/**
 * Format date safely avoiding timezone issues.
 * Parses YYYY-MM-DD manually instead of using new Date().
 */
function formatDateSafe(dateString: string): string {
  return formatDateBR(dateString, "");
}

export function InstallmentsCard({
  installments,
  currentTransactionId,
  disableLinks = false,
}: InstallmentsCardProps) {
  if (installments.length <= 1) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Parcelas ({installments.length}x)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {installments.map((installment) => {
            const Content = (
              <div
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  installment.id === currentTransactionId
                    ? "bg-primary/10 border-primary"
                    : disableLinks
                      ? "bg-muted/5 border-border"
                      : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-medium ${
                      installment.id === currentTransactionId
                        ? "text-primary"
                        : ""
                    }`}
                  >
                    Parcela {installment.installmentNumber}/
                    {installment.installmentCount}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDateSafe(installment.dueDate || installment.date)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      installment.status === "paid"
                        ? "success"
                        : installment.status === "overdue"
                          ? "destructive"
                          : "warning"
                    }
                    className="text-xs"
                  >
                    {installment.status === "paid"
                      ? "Pago"
                      : installment.status === "overdue"
                        ? "Atrasado"
                        : "Pendente"}
                  </Badge>
                  {installment.id === currentTransactionId && (
                    <Badge variant="outline" className="text-xs">
                      Editando
                    </Badge>
                  )}
                </div>
              </div>
            );

            if (disableLinks) {
              return <div key={installment.id}>{Content}</div>;
            }

            return (
              <Link
                key={installment.id}
                href={`/transactions/${installment.id}`}
                className="block"
              >
                {Content}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
