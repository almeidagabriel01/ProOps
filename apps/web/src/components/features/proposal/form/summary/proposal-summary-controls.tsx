import * as React from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProposalStatus } from "@/types/proposal";
import { Tag, CheckCircle2, Clock, Send, XCircle, FileEdit, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIFieldButton } from "@/components/shared/ai-field-button";

interface ProposalSummaryControlsProps {
  status: ProposalStatus;
  customNotes: string;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  statusOptions: { value: ProposalStatus; label: string }[];
  /** Optional context for AI notes generation */
  proposalContext?: {
    title?: string;
    clientName?: string;
    products?: { name: string; quantity: number }[];
    totalValue?: number;
    niche?: string;
  };
}

function getStatusMeta(status: string) {
  const map: Record<string, {
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    badgeBg: string;
  }> = {
    draft:       { icon: FileEdit,     color: "text-slate-600 dark:text-slate-300",    bg: "bg-slate-500/8",    border: "border-slate-200 dark:border-slate-700",   badgeBg: "bg-slate-100 dark:bg-slate-800" },
    in_progress: { icon: Clock,        color: "text-amber-700 dark:text-amber-400",    bg: "bg-amber-500/8",    border: "border-amber-200 dark:border-amber-700",    badgeBg: "bg-amber-100 dark:bg-amber-900/40" },
    sent:        { icon: Send,         color: "text-blue-700 dark:text-blue-400",      bg: "bg-blue-500/8",     border: "border-blue-200 dark:border-blue-700",      badgeBg: "bg-blue-100 dark:bg-blue-900/40" },
    approved:    { icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400",bg: "bg-emerald-500/8",  border: "border-emerald-200 dark:border-emerald-700", badgeBg: "bg-emerald-100 dark:bg-emerald-900/40" },
    rejected:    { icon: XCircle,      color: "text-red-700 dark:text-red-400",        bg: "bg-red-500/8",      border: "border-red-200 dark:border-red-700",         badgeBg: "bg-red-100 dark:bg-red-900/40" },
    default_2:   { icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400",bg: "bg-emerald-500/8",  border: "border-emerald-200 dark:border-emerald-700", badgeBg: "bg-emerald-100 dark:bg-emerald-900/40" },
  };
  return map[status] ?? {
    icon: Handshake,
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-500/8",
    border: "border-purple-200 dark:border-purple-700",
    badgeBg: "bg-purple-100 dark:bg-purple-900/40",
  };
}

export function ProposalSummaryControls({
  status,
  customNotes,
  onFormChange,
  statusOptions,
  proposalContext,
}: ProposalSummaryControlsProps) {
  const meta = getStatusMeta(status || "draft");
  const StatusIcon = meta.icon;
  const currentLabel = statusOptions.find((o) => o.value === status)?.label ?? status;

  return (
    <div className="space-y-6">
      {/* Status card — full width, vertically stacked */}
      <div className={cn("rounded-xl border-2 overflow-hidden", meta.border)}>
        {/* Header strip */}
        <div className={cn("px-5 py-3.5 flex items-center gap-3", meta.bg)}>
          <StatusIcon className={cn("w-5 h-5 shrink-0", meta.color)} />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest leading-none mb-1">
              Status Atual
            </p>
            <p className={cn("text-base font-bold leading-tight", meta.color)}>
              {currentLabel}
            </p>
          </div>
        </div>

        {/* Change section */}
        <div className="px-5 py-4 bg-background space-y-1.5 border-t border-border/60">
          <Label htmlFor="status" className="text-sm text-muted-foreground">
            Alterar status da proposta
          </Label>
          <Select
            id="status"
            name="status"
            value={status || "draft"}
            onChange={onFormChange}
            className="w-full"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Custom Notes */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="customNotes" className="flex items-center gap-2 font-medium">
            <Tag className="w-4 h-4 text-muted-foreground" />
            Observações Adicionais
          </Label>
          <AIFieldButton
            field="proposal.notes"
            context={() => ({
              title: proposalContext?.title ?? "",
              clientName: proposalContext?.clientName ?? "",
              products: proposalContext?.products ?? [],
              totalValue: proposalContext?.totalValue ?? 0,
              niche: proposalContext?.niche ?? "automacao_residencial",
            })}
            onGenerated={(value) =>
              onFormChange({
                target: { name: "customNotes", value },
              } as React.ChangeEvent<HTMLTextAreaElement>)
            }
            disabledReason={
              !proposalContext?.title
                ? "Preencha o título da proposta primeiro"
                : undefined
            }
          />
        </div>
        <Textarea
          id="customNotes"
          name="customNotes"
          value={customNotes || ""}
          onChange={onFormChange}
          placeholder="Notas ou condições especiais para esta proposta..."
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}
