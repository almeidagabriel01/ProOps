"use client";

import * as React from "react";
import { Plus, Trash2, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DecimalInput } from "@/components/ui/decimal-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ClientService, type Client } from "@/services/client-service";
import { useTenant } from "@/providers/tenant-provider";
import {
  COMMISSION_ROLE_LABELS,
  isCommissionPartner,
  primaryCommissionRole,
  type CommissionRole,
} from "@/lib/contacts/commission-partner";
import type { ProposalCommission } from "@/types/proposal";

interface ProposalCommissionsSectionProps {
  commissions: ProposalCommission[];
  onChange: (commissions: ProposalCommission[]) => void;
  /** Base de cálculo: já é o `closedValue` quando existe. */
  totalValue: number;
  isReadOnly?: boolean;
}

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Comissões de vendedor e arquiteto desta proposta.
 *
 * O percentual vem do cadastro do parceiro e é editável AQUI: o que vale é o
 * combinado nesta proposta, então mudar a comissão padrão do contato depois não
 * reescreve o que já foi fechado.
 *
 * Informação interna: não entra no PDF que o cliente recebe.
 */
export function ProposalCommissionsSection({
  commissions,
  onChange,
  totalValue,
  isReadOnly = false,
}: ProposalCommissionsSectionProps) {
  const { tenant } = useTenant();
  const [partners, setPartners] = React.useState<Client[]>([]);

  React.useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    ClientService.getClients(tenant.id)
      .then((clients) => {
        if (cancelled) return;
        setPartners(clients.filter(isCommissionPartner));
      })
      .catch(() => {
        if (!cancelled) setPartners([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  const takenKeys = React.useMemo(
    () => new Set(commissions.map((c) => `${c.contactId}:${c.role}`)),
    [commissions],
  );

  const options = React.useMemo(
    () =>
      partners.map((partner) => ({
        value: partner.id,
        label: partner.name,
        description: (partner.types || [])
          .filter((t): t is CommissionRole => t in COMMISSION_ROLE_LABELS)
          .map((t) => COMMISSION_ROLE_LABELS[t])
          .join(" e "),
      })),
    [partners],
  );

  const addPartner = (contactId: string) => {
    const partner = partners.find((p) => p.id === contactId);
    if (!partner) return;
    const role = primaryCommissionRole(partner);
    if (!role || takenKeys.has(`${contactId}:${role}`)) return;

    onChange([
      ...commissions,
      {
        contactId,
        contactName: partner.name,
        role,
        // Cópia do cadastro, não referência: o que vale é o valor gravado aqui.
        percentage: partner.commissionPercentage ?? 0,
      },
    ]);
  };

  const updatePercentage = (index: number, percentage: number) => {
    onChange(
      commissions.map((c, i) => (i === index ? { ...c, percentage } : c)),
    );
  };

  const remove = (index: number) => {
    onChange(commissions.filter((_, i) => i !== index));
  };

  const commissionValue = (percentage: number) =>
    (totalValue * (percentage || 0)) / 100;

  const totalCommissions = commissions.reduce(
    (sum, c) => sum + commissionValue(c.percentage),
    0,
  );

  const availableOptions = options.filter(
    (option) =>
      !commissions.some((c) => c.contactId === option.value) &&
      partners.some((p) => p.id === option.value && primaryCommissionRole(p)),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Handshake className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">Comissões</p>
          <p className="text-xs text-muted-foreground">
            Vendedor e arquiteto recebem no mesmo cronograma do cliente. Não
            aparece no PDF.
          </p>
        </div>
      </div>

      {commissions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {partners.length === 0
            ? "Nenhum contato marcado como vendedor ou arquiteto ainda. Marque o tipo no cadastro do contato."
            : "Nenhuma comissão nesta proposta."}
        </p>
      )}

      {commissions.map((commission, index) => (
        <div
          key={`${commission.contactId}-${commission.role}`}
          className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{commission.contactName}</p>
            <p className="text-xs text-muted-foreground">
              {COMMISSION_ROLE_LABELS[commission.role]}
            </p>
          </div>

          <div className="flex items-end gap-3">
            {/* Os dois campos têm a MESMA altura de controle (h-8, a do
                DecimalInput) para os rótulos ficarem na mesma linha de base e o
                valor alinhar com o input, não com o topo dele. */}
            <div className="w-28 shrink-0">
              <Label
                htmlFor={`commission-${index}`}
                className="mb-1 block text-xs font-normal text-muted-foreground"
              >
                Percentual (%)
              </Label>
              <DecimalInput
                id={`commission-${index}`}
                value={commission.percentage}
                onChange={(value) => updatePercentage(index, value)}
                disabled={isReadOnly}
                className="w-full text-base md:text-sm"
                aria-label={`Percentual de comissão de ${commission.contactName}`}
              />
            </div>

            <div className="w-32 shrink-0">
              <Label className="mb-1 block text-xs font-normal text-muted-foreground">
                Valor
              </Label>
              <p className="flex h-8 items-center justify-end font-mono text-sm font-semibold tabular-nums">
                {formatBRL(commissionValue(commission.percentage))}
              </p>
            </div>

            {!isReadOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => remove(index)}
                aria-label={`Remover comissão de ${commission.contactName}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {!isReadOnly && availableOptions.length > 0 && (
        <div>
          <Label
            htmlFor="commission-add"
            className="mb-1 flex items-center gap-1.5 text-xs font-normal text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Adicionar parceiro
          </Label>
          <SearchableSelect
            id="commission-add"
            value=""
            options={availableOptions}
            onValueChange={addPartner}
            placeholder="Selecione um vendedor ou arquiteto"
          />
        </div>
      )}

      {commissions.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">
            Total de comissões
          </span>
          <span className="font-mono font-medium">
            {formatBRL(totalCommissions)}
          </span>
        </div>
      )}
    </div>
  );
}
