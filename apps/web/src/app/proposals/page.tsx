"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useThemePrimaryColor } from "@/hooks/useThemePrimaryColor";
import { cn } from "@/lib/utils";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Proposal, ProposalStatus, ProposalAttachment } from "@/types/proposal";
import { ProposalActionsDropdown } from "@/components/features/proposal/proposal-actions-dropdown";
import { IssueInvoiceButton } from "@/components/features/fiscal/issue-invoice-button";
import { FiscalGapsDialog } from "@/components/features/fiscal/fiscal-gaps-dialog";
import { useIssueInvoice } from "@/hooks/use-issue-invoice";
import { useProposalInvoicePrompt } from "@/hooks/use-proposal-invoice-prompt";
import { isApprovedColumn } from "@/lib/proposal-approval";
import { ProposalInvoicePrompt } from "@/components/features/fiscal/proposal-invoice-prompt";
import { ProposalAttachmentsDialog } from "@/components/features/proposal/proposal-attachments-dialog";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import {
  Plus,
  FileText,
  Search,
  ChevronDown,
  Check,
  Crown,
  Eye,
  FileDown,
  Trash2,
  Palette,
  Pencil,
  Kanban,
  ShieldCheck,
  MessageSquareWarning,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { replaceUrlSearchParams } from "@/lib/url-state";
import { proposalStatusFilterOptions } from "@/lib/proposal-status-filter";
import { ProposalsSkeleton } from "./_components/proposals-skeleton";
import { ClientAcceptanceDialog } from "./_components/client-acceptance-dialog";
import { ClientChangeRequestDialog } from "./_components/client-change-request-dialog";
import {
  hasOpenChangeRequest,
  hasPendingAcceptance,
  isAcceptancePending,
  isChangeRequestOpen,
  pickApprovedColumnId,
} from "@/lib/client-acceptance";
import { useClientResponses } from "@/hooks/use-client-responses";
import { ProposalsTableSkeleton } from "./_components/proposals-table-skeleton";
import { normalize } from "@/utils/text";
import {
  DRIVE_DELIVERY_PENDING_HINT,
  DRIVE_NOT_CONNECTED_HINT,
} from "@/lib/proposal-payment";
import {
  SendProposalDialog,
  type SendProposalTarget,
} from "./_components/send-proposal-dialog";
import { runUndoableAction } from "@/lib/undoable-action";
import { toast } from "@/lib/toast";
import { isDemoReadOnlyError } from "@/lib/api-client";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useSort } from "@/hooks/use-sort";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

import {
  KanbanService,
  KanbanStatusColumn,
  getDefaultProposalColumns,
} from "@/services/kanban-service";

const LEGACY_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "#94a3b8" }, // gray-400
  in_progress: { label: "Em Progresso", color: "#3b82f6" }, // blue-500
  sent: { label: "Enviada", color: "#eab308" }, // yellow-500
  approved: { label: "Aprovada", color: "#22c55e" }, // green-500
  rejected: { label: "Rejeitada", color: "#ef4444" }, // red-500
};

import { ProposalService } from "@/services/proposal-service";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePdfGenerator } from "@/components/features/proposal/pdf/use-pdf-generator";
import { Tenant } from "@/types";
import { SharedProposalService } from "@/services/shared-proposal-service";
import { formatDateBR } from "@/utils/date-format";
import { Loader } from "@/components/ui/loader";

function PdfDownloader({
  proposal,
  tenant,
  isOpen,
  onClose,
}: {
  proposal: Proposal | null;
  tenant: Tenant | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { handleGenerate, isGenerating } = usePdfGenerator({
    proposal: proposal || {},
    tenant,
    showCover: true,
    canonicalSource: false,
    setIsOpen: (v) => !v && onClose(),
  });

  React.useEffect(() => {
    if (isOpen && proposal && !isGenerating) {
      const rafId = window.requestAnimationFrame(() => {
        void handleGenerate(undefined, "download");
      });
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [isOpen, proposal, isGenerating, handleGenerate]);

  return null;
}

export default function ProposalsPage() {
  const router = useRouter();
  const { tenant, isReadOnly } = useTenant();
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = usePagePermission("proposals");
  // O CRM não está na dock — chega-se a ele por este botão, então é aqui que a
  // permissão de kanban tem que ser checada (o plano é gate separado).
  const { canView: canViewCrm } = usePagePermission("kanban");
  // Emitir nota a partir da proposta e acao do modulo de notas, nao do de
  // propostas — quem nao pode emitir nao ve o botao nem o convite.
  const { canCreate: canIssueInvoice } = usePagePermission("invoices");
  const { hasKanban } = usePlanLimits();
  const upgradeModal = useUpgradeModal();
  const canAccessCrm = hasKanban || user?.role === "superadmin";
  const premiumColor = useThemePrimaryColor();
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  // Busca e status vivem também no endereço: voltar da proposta aberta ou
  // recarregar a página mantém a lista como estava.
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = React.useState(
    () => searchParams.get("q") ?? "",
  );
  const [statusFilter, setStatusFilter] = React.useState(
    () => searchParams.get("status") ?? "",
  );
  React.useEffect(() => {
    replaceUrlSearchParams({
      q: searchTerm.trim() || null,
      status: statusFilter || null,
    });
  }, [searchTerm, statusFilter]);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  // Aceite do cliente em revisão. Vem do endereço (`?aceite=<id>`) quando a
  // pessoa chega pela notificação, ou do selo na coluna de status.
  const [acceptanceId, setAcceptanceId] = React.useState<string | null>(
    () => searchParams.get("aceite"),
  );
  const [acceptanceFallback, setAcceptanceFallback] = React.useState<Proposal | null>(null);
  const [changeRequestId, setChangeRequestId] = React.useState<string | null>(
    () => searchParams.get("ajuste"),
  );
  // Aceites e pedidos de mudança em aberto, ao vivo: chegam com a tela aberta.
  const clientResponses = useClientResponses(tenant?.id);
  const [updatingStatusId, setUpdatingStatusId] = React.useState<string | null>(
    null,
  );
  const [kanbanColumns, setKanbanColumns] = React.useState<
    KanbanStatusColumn[]
  >([]);

  // Load kanban columns to show proper status labels
  React.useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    KanbanService.getStatuses(tenant.id)
      .then((columns) => {
        if (cancelled) return;
        if (columns.length === 0) {
          setKanbanColumns(
            getDefaultProposalColumns().map(
              (c, i) => ({ ...c, id: `default_${i}` }) as KanbanStatusColumn,
            ),
          );
        } else {
          setKanbanColumns(columns);
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  const getStatusLabel = React.useCallback(
    (status: string) => {
      if (status === "draft") return "Rascunho";
      const col =
        kanbanColumns.find((c) => c.id === status) ||
        kanbanColumns.find((c) => c.mappedStatus === status);

      if (col) return col.label;

      // Fallback to old hardcoded statuses
      const fallback = LEGACY_STATUS_CONFIG[status];
      return fallback ? fallback.label : "Desconhecido";
    },
    [kanbanColumns],
  );

  /**
   * Espelha `isStatusApproved` do backend: além do status direto, uma proposta
   * pode estar ganha por estar numa coluna do Kanban mapeada como aprovada ou
   * marcada como "won". Divergir daqui faria o botão sumir em propostas que o
   * backend aceita faturar.
   */
  const isProposalApproved = React.useCallback(
    (proposal: Proposal) => {
      if (proposal.status === "approved") return true;
      const col =
        kanbanColumns.find((c) => c.id === proposal.status) ||
        kanbanColumns.find((c) => c.mappedStatus === proposal.status);
      return isApprovedColumn(col);
    },
    [kanbanColumns],
  );

  const getStatusColor = React.useCallback(
    (status: string) => {
      const defaultColor = "#94a3b8"; // draft gray
      if (status === "draft") return defaultColor;
      const col =
        kanbanColumns.find((c) => c.id === status) ||
        kanbanColumns.find((c) => c.mappedStatus === status);

      if (col) return col.color;

      // Fallback to old hardcoded colors
      const fallback = LEGACY_STATUS_CONFIG[status];
      return fallback ? fallback.color : defaultColor;
    },
    [kanbanColumns],
  );
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [sharingId, setSharingId] = React.useState<string | null>(null);
  const [sendTarget, setSendTarget] =
    React.useState<SendProposalTarget | null>(null);
  const [, setIsGeneratingShareLink] = React.useState(false);
  const [attachmentsProposalId, setAttachmentsProposalId] = React.useState<
    string | null
  >(null);
  const [hasAnyProposals, setHasAnyProposals] = React.useState<boolean | null>(
    null,
  );
  // A emissão vive na página, não no item do menu: o conteúdo do dropdown
  // desmonta ao fechar, e o checklist de lacunas iria junto.
  const {
    issue: issueInvoice,
    issuingId: issuingInvoiceId,
    gaps: fiscalGaps,
    closeGaps: closeFiscalGaps,
  } = useIssueInvoice();
  const invoicePrompt = useProposalInvoicePrompt();
  const { promptAfterApproval, startPreview } = invoicePrompt;
  const [isAwaitingPendingSave, setIsAwaitingPendingSave] =
    React.useState(true);
  // Cache for attachments to prevent fetchProposals from overwriting local updates
  const attachmentsCacheRef = React.useRef<Map<string, ProposalAttachment[]>>(
    new Map(),
  );
  const resetRef = React.useRef<(() => void) | null>(null);
  const refreshRef = React.useRef<(() => void) | null>(null);
  const updateItemsRef = React.useRef<
    ((updater: (items: Proposal[]) => Proposal[]) => void) | null
  >(null);
  const isFiltering = searchTerm.trim() !== "";
  const [asyncDataReady, setAsyncDataReady] = React.useState(false);

  const handleEdit = React.useCallback(
    (id: string) => {
      setEditingId(id);
      router.push(`/proposals/${id}`);
    },
    [router],
  );

  const handleDownload = (proposal: Proposal) => {
    setDownloadingId(proposal.id);
  };

  // Check if a proposal has all required fields for PDF generation
  const canGeneratePdf = (proposal: Proposal): boolean => {
    // Draft proposals cannot generate PDF
    if (proposal.status === "draft") {
      return false;
    }

    const hasValidTitle =
      proposal.title &&
      proposal.title.trim() !== "" &&
      proposal.title !== "(Rascunho)";
    const hasValidClient =
      proposal.clientName &&
      proposal.clientName.trim() !== "" &&
      proposal.clientName !== "(Rascunho)";
    const hasProducts = proposal.products && proposal.products.length > 0;
    return Boolean(hasValidTitle && hasValidClient && hasProducts);
  };

  const handleShare = async (proposal: Proposal) => {
    setSharingId(proposal.id);
    setIsGeneratingShareLink(true);
    try {
      const result = await SharedProposalService.generateShareLink(proposal.id);
      setSendTarget({
        url: result.shareUrl,
        title: proposal.title,
        clientName: proposal.clientName,
        clientPhone: proposal.clientPhone,
        clientEmail: proposal.clientEmail,
      });
    } catch (error) {
      if (!isDemoReadOnlyError(error)) {
        console.error("Error generating share link:", error);
        toast.error("Erro ao gerar link de compartilhamento");
      }
    } finally {
      setIsGeneratingShareLink(false);
      setSharingId(null);
    }
  };

  const {
    items: sortedProposals,
    requestSort,
    sortConfig,
  } = useSort(proposals);

  // Filter proposals based on search term (and the status filter, when set)
  const filteredProposals = React.useMemo(() => {
    if (!isFiltering) return [];

    const term = normalize(searchTerm);
    return sortedProposals.filter(
      (proposal) =>
        (!statusFilter || proposal.status === statusFilter) &&
        (normalize(proposal.title).includes(term) ||
          normalize(proposal.clientName || "").includes(term) ||
          normalize(getStatusLabel(proposal.status)).includes(term)),
    );
  }, [sortedProposals, searchTerm, isFiltering, getStatusLabel, statusFilter]);

  const statusFilterOptions = React.useMemo(
    () => proposalStatusFilterOptions(kanbanColumns),
    [kanbanColumns],
  );

  /* isPageLoading is now false for search to prevent table blink. We use isLoading for Input spinner. */
  const isPageLoading = false;

  // Show full page skeleton until initial async data is ready (or empty state determined)
  const showFullPageSkeleton =
    !isFiltering &&
    (!asyncDataReady || isAwaitingPendingSave) &&
    hasAnyProposals !== false;

  const refreshHasAnyProposals = React.useCallback(async () => {
    if (!tenant) {
      setHasAnyProposals(false);
      return false;
    }

    try {
      await Promise.race([
        ProposalService.waitForSave(),
        new Promise<void>((resolve) => setTimeout(resolve, 10000)),
      ]);
      const result = await ProposalService.getProposalsPaginated(tenant.id, 1);
      const hasProposals = result.data.length > 0;
      setHasAnyProposals(hasProposals);
      return hasProposals;
    } catch {
      setHasAnyProposals(false);
      return false;
    }
  }, [tenant]);

  // Check if there are any proposals (for empty state)
  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!tenant) {
        setHasAnyProposals(false);
        return;
      }
      try {
        // Timeout de segurança: máx 10s esperando o save pendente
        await Promise.race([
          ProposalService.waitForSave(),
          new Promise<void>((resolve) => setTimeout(resolve, 10000)),
        ]);
        if (cancelled) return;
        const result = await ProposalService.getProposalsPaginated(
          tenant.id,
          1,
        );
        if (!cancelled) {
          setHasAnyProposals(result.data.length > 0);
        }
      } catch {
        if (!cancelled) {
          setHasAnyProposals(false);
        }
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  React.useEffect(() => {
    let cancelled = false;
    const waitPendingSave = async () => {
      if (!tenant) {
        setIsAwaitingPendingSave(false);
        return;
      }
      setIsAwaitingPendingSave(true);
      try {
        // Timeout de segurança: se waitForSave travar por algum motivo, libera em 10s
        await Promise.race([
          ProposalService.waitForSave(),
          new Promise<void>((resolve) => setTimeout(resolve, 10000)),
        ]);
      } finally {
        if (!cancelled) {
          setIsAwaitingPendingSave(false);
        }
      }
    };
    waitPendingSave();
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  React.useEffect(() => {
    if (!tenant) {
      setProposals([]);
      return;
    }

    if (hasAnyProposals === false) {
      setProposals([]);
    }
  }, [hasAnyProposals, tenant]);

  // fetchPage callback for async pagination
  const fetchPage = React.useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      if (!tenant)
        return { data: [] as Proposal[], lastDoc: null, hasMore: false };
      await ProposalService.waitForSave();
      return ProposalService.getProposalsPaginated(
        tenant.id,
        12,
        cursor,
        sortConfig?.key
          ? {
              key: sortConfig.key as string,
              direction: sortConfig.direction || "asc",
            }
          : null,
        statusFilter || null,
      );
    },
    [tenant, sortConfig, statusFilter],
  );

  // Reset pagination when sort or status filter changes
  React.useEffect(() => {
    resetRef.current?.();
  }, [sortConfig, statusFilter]);

  const fetchProposals = React.useCallback(async () => {
    if (tenant) {
      setIsLoading(true);
      try {
        // Aguarda salvar pendente com timeout de segurança (5s) para nunca travar
        await Promise.race([
          ProposalService.waitForSave(),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);
        // Busca indexada via searchTokens (title + clientName) — não baixa
        // mais a coleção inteira. Termo sem palavra de >= 2 chars retorna
        // [] sem query (ver ProposalService.searchProposals).
        const data = await ProposalService.searchProposals(
          tenant.id,
          searchTerm,
          100,
        );

        // Sort by createdAt descending (most recent first)
        data.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        setProposals(data);
      } catch (error) {
        console.error("Failed to fetch proposals", error);
        toast.error(
          "Erro ao carregar propostas. Verifique sua conexão e tente novamente.",
          {
            title: "Erro ao carregar",
          },
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [tenant, searchTerm]);

  // Search fetch — debounced; re-queries when o termo (token) muda
  React.useEffect(() => {
    if (!isFiltering || !tenant) return;
    const timeoutId = setTimeout(() => {
      fetchProposals();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [isFiltering, tenant, fetchProposals]);

  // Subscribe to updates (e.g. from auto-save)
  React.useEffect(() => {
    return ProposalService.subscribe(() => {
      refreshRef.current?.();
      if (isFiltering) {
        fetchProposals();
      }
    });
  }, [fetchProposals, isFiltering]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!deleteId) return;

    const proposal = proposals.find((p) => p.id === deleteId);
    const proposalLabel = proposal?.title?.trim()
      ? `"${proposal.title.trim()}"`
      : `ID ${deleteId}`;

    // A exclusão só vai para o servidor depois da janela de "Desfazer": a
    // proposta sai da lista agora, e desfazer é recarregar a lista, porque o
    // documento continua lá.
    const removedId = deleteId;
    const remainingProposals = proposals.filter((p) => p.id !== removedId);
    updateItemsRef.current?.((items) =>
      items.filter((p) => p.id !== removedId),
    );
    setProposals(remainingProposals);
    if (remainingProposals.length === 0) {
      setHasAnyProposals(false);
    }
    setDeleteId(null);

    const restoreList = () => {
      void refreshHasAnyProposals();
      refreshRef.current?.();
    };

    runUndoableAction({
      message: `Proposta ${proposalLabel} excluída.`,
      title: "Proposta excluída",
      commit: async () => {
        await ProposalService.deleteProposal(removedId);
        // Secondary verification against Firestore to ensure consistency
        // (handles edge cases like concurrent deletes from another session).
        await refreshHasAnyProposals();
      },
      onUndo: restoreList,
      onCommitError: (error) => {
        console.error(error);
        const errorMessage =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Falha inesperada ao excluir a proposta.";
        toast.error(
          `Não foi possível excluir a proposta ${proposalLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao excluir" },
        );
        restoreList();
      },
    });
  };

  const handleDuplicate = React.useCallback(
    async (id: string) => {
      setDuplicatingId(id);
      try {
        const original = proposals.find((p) => p.id === id);
        if (!original) return;
        if (!tenant) return;

        await ProposalService.createProposal({
          title: `${original.title} (Cópia)`,
          tenantId: original.tenantId,
          clientId: original.clientId || "",
          clientName: original.clientName || "",
          clientEmail: original.clientEmail,
          clientPhone: original.clientPhone,
          clientAddress: original.clientAddress,
          validUntil: original.validUntil,
          status: "in_progress",
          products: original.products || [],
          sistemas: original.sistemas || [],
          customNotes: original.customNotes,
          discount: original.discount || 0,
          totalValue: original.totalValue || 0,
          sections: original.sections || [],
          pdfSettings: original.pdfSettings,
        });

        refreshRef.current?.();
        toast.success("Proposta duplicada com sucesso!");
      } catch (error) {
        console.error("Duplicate error:", error);
        toast.error("Erro ao duplicar proposta.");
      } finally {
        setDuplicatingId(null);
      }
    },
    [proposals, tenant],
  );

  const formatDate = (dateString: string | undefined) => {
    return formatDateBR(dateString);
  };

  const sortLabelsPtBr = React.useCallback((values: string[]) => {
    return [...values].sort((a, b) =>
      a.localeCompare(b, "pt-BR", {
        sensitivity: "base",
        numeric: true,
      }),
    );
  }, []);

  const handleStatusChange = React.useCallback(
    async (proposalId: string, rawStatus: string) => {
      const column = kanbanColumns.find((c) => c.id === rawStatus);
      const newStatus =
        column?.id.startsWith("default_") && column?.mappedStatus
          ? (column.mappedStatus as ProposalStatus)
          : (rawStatus as ProposalStatus);

      const proposal = proposals.find((p) => p.id === proposalId);
      if (!proposal || proposal.status === newStatus) return;
      const proposalLabel = proposal.title?.trim()
        ? `"${proposal.title.trim()}"`
        : `ID ${proposalId}`;

      // A checagem não depende do status — ela monta os documentos a partir
      // dos itens. Disparando aqui, ela corre EM PARALELO com a gravação em
      // vez de começar depois dela; serializadas, o convite aparecia segundos
      // depois do toast e a tela parecia travada nesse intervalo.
      const vaiAprovar = isProposalApproved({ ...proposal, status: newStatus });
      // Sem permissao de emitir, nem o preview e disparado: a chamada seria
      // um 403 e o convite nunca poderia ser aceito.
      const pendingPreview =
        vaiAprovar && canIssueInvoice ? startPreview(proposalId) : null;

      setUpdatingStatusId(proposalId);
      try {
        const result = await ProposalService.updateProposal(proposalId, {
          status: newStatus,
        });
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId ? { ...p, status: newStatus } : p,
          ),
        );
        toast.success(
          `Status da proposta ${proposalLabel} alterado para "${getStatusLabel(newStatus).toLocaleLowerCase("pt-BR")}".`,
          { title: "Sucesso ao editar" },
        );
        // A entrega no Drive saiu da request e roda num cron: sem o aviso,
        // quem aprova e vai direto na pasta do cliente acha que falhou.
        if (result?.driveDeliveryQueued) {
          toast.info(DRIVE_DELIVERY_PENDING_HINT);
        } else if (result?.driveNotConnected) {
          toast.info(DRIVE_NOT_CONNECTED_HINT);
        }
        // O convite em si só depois do sucesso: sugerir faturar uma mudança de
        // status que falhou seria pior que não sugerir.
        if (pendingPreview) {
          void promptAfterApproval(
            proposalId,
            proposal.title?.trim() || "",
            pendingPreview,
          );
        }
        return true;
      } catch (error) {
        console.error("Error updating status:", error);
        const errorMessage =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Falha inesperada ao alterar o status da proposta.";
        toast.error(
          `Não foi possível alterar o status da proposta ${proposalLabel}. Detalhes: ${errorMessage}`,
          { title: "Erro ao editar" },
        );
        return false;
      } finally {
        setUpdatingStatusId(null);
      }
    },
    [
      proposals,
      getStatusLabel,
      kanbanColumns,
      isProposalApproved,
      promptAfterApproval,
      startPreview,
      canIssueInvoice,
    ],
  );

  // A notificação pode apontar para uma proposta fora da página carregada.
  const acceptanceFromList = acceptanceId
    ? clientResponses.acceptances.get(acceptanceId) ??
      proposals.find((p) => p.id === acceptanceId) ??
      null
    : null;
  React.useEffect(() => {
    if (!acceptanceId || acceptanceFromList) return;
    let cancelled = false;
    ProposalService.getProposalById(acceptanceId)
      .then((found) => {
        if (!cancelled) setAcceptanceFallback(found);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [acceptanceId, acceptanceFromList]);
  const acceptanceCandidate =
    acceptanceFromList ??
    (acceptanceFallback?.id === acceptanceId ? acceptanceFallback : null);
  const acceptanceTarget =
    acceptanceCandidate && isAcceptancePending(acceptanceCandidate)
      ? acceptanceCandidate
      : null;

  const closeAcceptance = React.useCallback(() => {
    setAcceptanceId(null);
    replaceUrlSearchParams({ aceite: null });
  }, []);

  const markAcceptanceResolved = React.useCallback(
    (proposalId: string, status: "confirmed" | "discarded") => {
      const resolve = (p: Proposal) =>
        p.id === proposalId && p.clientAcceptance
          ? { ...p, clientAcceptance: { ...p.clientAcceptance, status } }
          : p;
      setProposals((prev) => prev.map(resolve));
      updateItemsRef.current?.((items) => items.map(resolve));
    },
    [],
  );

  const confirmAcceptance = React.useCallback(async () => {
    if (!acceptanceTarget) return;
    // Confirmar é o mesmo caminho de mudar o status para aprovada: o backend
    // gera os lançamentos, entrega no Drive e marca o aceite como confirmado.
    const approvedColumnId = pickApprovedColumnId(kanbanColumns);
    let ok: boolean | undefined;
    if (proposals.some((p) => p.id === acceptanceTarget.id)) {
      ok = await handleStatusChange(acceptanceTarget.id, approvedColumnId);
    } else {
      // Fora da página carregada: sem a linha, a troca de status da lista
      // não tem o que atualizar, então grava direto.
      const column = kanbanColumns.find((c) => c.id === approvedColumnId);
      const status =
        column?.id.startsWith("default_") && column.mappedStatus
          ? (column.mappedStatus as ProposalStatus)
          : (approvedColumnId as ProposalStatus);
      try {
        await ProposalService.updateProposal(acceptanceTarget.id, { status });
        toast.success("Aprovação confirmada.");
        ok = true;
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível confirmar a aprovação.",
        );
        ok = false;
      }
    }
    // Falhou: o toast de erro já apareceu e o diálogo fica aberto.
    if (!ok) throw new Error("STATUS_CHANGE_FAILED");
    markAcceptanceResolved(acceptanceTarget.id, "confirmed");
  }, [acceptanceTarget, handleStatusChange, kanbanColumns, markAcceptanceResolved, proposals]);

  const adjustAcceptance = React.useCallback(async () => {
    if (!acceptanceTarget) return;
    try {
      await ProposalService.discardClientAcceptance(acceptanceTarget.id);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível descartar o aceite.",
      );
      throw error;
    }
    markAcceptanceResolved(acceptanceTarget.id, "discarded");
    toast.info("Aceite descartado. Ajuste a proposta e reenvie o link para o cliente aceitar de novo.");
    router.push(`/proposals/${acceptanceTarget.id}`);
  }, [acceptanceTarget, markAcceptanceResolved, router]);

  const changeRequestTarget = (() => {
    if (!changeRequestId) return null;
    const found =
      clientResponses.changeRequests.get(changeRequestId) ??
      proposals.find((p) => p.id === changeRequestId);
    return found && isChangeRequestOpen(found) ? found : null;
  })();

  const closeChangeRequest = React.useCallback(() => {
    setChangeRequestId(null);
    replaceUrlSearchParams({ ajuste: null });
  }, []);

  const editForChangeRequest = React.useCallback(() => {
    if (!changeRequestTarget) return;
    router.push(`/proposals/${changeRequestTarget.id}`);
  }, [changeRequestTarget, router]);

  const resolveChangeRequest = React.useCallback(async () => {
    if (!changeRequestTarget) return;
    try {
      await ProposalService.resolveChangeRequest(changeRequestTarget.id);
      toast.success("Pedido de mudanças encerrado.");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível encerrar o pedido.",
      );
      throw error;
    }
  }, [changeRequestTarget]);

  const proposalToDelete = sortedProposals.find((p) => p.id === deleteId);
  const columns: DataTableColumn<Proposal>[] = React.useMemo(
    () => [
      {
        key: "title",
        header: "Título",
        priority: "primary",
        render: (proposal) => {
          const productCount = proposal.products?.length || 0;
          const total =
            proposal.products?.reduce(
              (sum: number, p: { total: number }) => sum + p.total,
              0,
            ) || 0;
          return (
            <div>
              {/* O código vai ACIMA do título, não numa coluna própria: a
                  tabela tem sete colunas contadas na mão (`grid-cols-7`), e
                  uma oitava empurraria a coluna de ações para a linha de
                  baixo. Some sozinho em quem não usa numeração. */}
              {proposal.proposalCode && (
                <div className="text-xs font-mono text-muted-foreground">
                  {proposal.proposalCode}
                </div>
              )}
              {/* Clamp no título, não no wrapper: o subtítulo abaixo precisa
                  continuar visível. */}
              <Link
                href={`/proposals/${proposal.id}?initialStep=automation`}
                className="font-medium hover:underline max-md:line-clamp-2 wrap-break-word"
              >
                {proposal.title}
              </Link>
              {productCount > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {productCount} produto(s) • R$ {total.toFixed(2)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "clientName",
        header: "Contato",
        priority: "secondary",
        render: (proposal) => (
          <div className="text-sm text-muted-foreground truncate">
            {proposal.clientName}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        priority: "secondary",
        render: (proposal) => (
          <div>
            {canEdit && !isReadOnly ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="focus:outline-none cursor-pointer"
                    disabled={updatingStatusId === proposal.id}
                  >
                    <Badge
                      style={{
                        backgroundColor: getStatusColor(proposal.status) + "20",
                        color: getStatusColor(proposal.status),
                        borderColor: getStatusColor(proposal.status) + "40",
                      }}
                      className="text-xs cursor-pointer hover:brightness-110 transition-all gap-1 pr-1.5 min-w-[100px] justify-start border"
                    >
                      {updatingStatusId === proposal.id ? (
                        <Loader size="sm" />
                      ) : null}
                      {getStatusLabel(proposal.status)}
                      <ChevronDown className="w-3 h-3 opacity-60 ml-1" />
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[140px]">
                  {kanbanColumns.map((col) => {
                    const isActive =
                      proposal.status === col.id ||
                      (col.mappedStatus &&
                        proposal.status === col.mappedStatus);
                    return (
                      <DropdownMenuItem
                        key={col.id}
                        onClick={() => handleStatusChange(proposal.id, col.id)}
                        className={isActive ? "bg-muted" : ""}
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: col.color }}
                        />
                        {col.label}
                        {isActive && <Check className="w-4 h-4 ml-auto" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge
                style={{
                  backgroundColor: getStatusColor(proposal.status) + "20",
                  color: getStatusColor(proposal.status),
                  borderColor: getStatusColor(proposal.status) + "40",
                }}
                className="border"
              >
                {getStatusLabel(proposal.status)}
              </Badge>
            )}
            {hasPendingAcceptance(proposal, clientResponses) && (
              <button
                type="button"
                onClick={() => setAcceptanceId(proposal.id)}
                className="mt-1 flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
              >
                <ShieldCheck className="h-3 w-3" />
                Aceite do cliente
              </button>
            )}
            {hasOpenChangeRequest(proposal, clientResponses) && (
              <button
                type="button"
                onClick={() => setChangeRequestId(proposal.id)}
                className="mt-1 flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-700 hover:bg-orange-500/20 dark:text-orange-400"
              >
                <MessageSquareWarning className="h-3 w-3" />
                Ajuste solicitado
              </button>
            )}
          </div>
        ),
      },
      {
        key: "primaryEnvironment",
        header: "Ambiente",
        sortable: true,
        priority: "hidden",
        render: (proposal) => {
          const ambienteNamesFromSystems =
            proposal.sistemas?.flatMap((s) => {
              const namesFromNested = Array.isArray(s.ambientes)
                ? s.ambientes
                    .map((ambiente) => ambiente.ambienteName)
                    .filter(Boolean)
                : [];

              if (namesFromNested.length > 0) {
                return namesFromNested;
              }

              return s.ambienteName ? [s.ambienteName] : [];
            }) || [];

          const uniqueAmbientes = Array.from(
            new Set(
              ambienteNamesFromSystems.length > 0
                ? ambienteNamesFromSystems
                : proposal.primaryEnvironment
                  ? [proposal.primaryEnvironment]
                  : [],
            ),
          );
          const sortedAmbientes = sortLabelsPtBr(uniqueAmbientes);
          return (
            <div className="text-sm text-muted-foreground truncate">
              {sortedAmbientes.length > 0 ? (
                <span title={sortedAmbientes.join(", ")}>
                  {sortedAmbientes.length > 2
                    ? `${sortedAmbientes.slice(0, 2).join(", ")} +${sortedAmbientes.length - 2}`
                    : sortedAmbientes.join(", ")}
                </span>
              ) : (
                "-"
              )}
            </div>
          );
        },
      },
      {
        key: "primarySystem",
        header: "Solução",
        sortable: true,
        priority: "hidden",
        render: (proposal) => {
          const systemsFromArray =
            proposal.sistemas?.flatMap((s) =>
              s.sistemaName ? [s.sistemaName] : [],
            ) || [];

          const uniqueSistemas = Array.from(
            new Set(
              systemsFromArray.length > 0
                ? systemsFromArray
                : proposal.primarySystem
                  ? [proposal.primarySystem]
                  : [],
            ),
          );
          const sortedSistemas = sortLabelsPtBr(uniqueSistemas);
          return (
            <div className="text-sm text-muted-foreground truncate">
              {sortedSistemas.length > 0 ? (
                <span title={sortedSistemas.join(", ")}>
                  {sortedSistemas.length > 2
                    ? `${sortedSistemas.slice(0, 2).join(", ")} +${sortedSistemas.length - 2}`
                    : sortedSistemas.join(", ")}
                </span>
              ) : (
                "-"
              )}
            </div>
          );
        },
      },
      {
        key: "validUntil",
        header: "Validade",
        priority: "secondary",
        render: (proposal) => (
          <div className="text-sm text-muted-foreground">
            {formatDate(proposal.validUntil)}
          </div>
        ),
      },
      {
        key: "actions",
        header: "Ações",
        sortable: false,
        className: "text-right",
        headerClassName: "flex justify-end",
        priority: "actions",
        render: (proposal) => (
          <div className="flex items-center justify-end gap-1">
            {/* Individual action buttons — hidden on small screens (≤1700px) */}
            <div className="hidden min-[1701px]:flex items-center gap-1">
              {/* Ver PDF */}
              {proposal.status !== "draft" ? (
                <Link href={`/proposals/${proposal.id}/view`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Ver PDF"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground cursor-not-allowed opacity-50"
                  title="Rascunhos não podem ser visualizados"
                  disabled
                >
                  <Eye className="w-4 h-4" />
                </Button>
              )}

              {/* Baixar PDF */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  proposal.status === "draft"
                    ? "Rascunhos não podem ser baixados"
                    : canGeneratePdf(proposal)
                      ? "Baixar PDF"
                      : "Preencha título, cliente e produtos para baixar o PDF"
                }
                onClick={() => handleDownload(proposal)}
                disabled={
                  downloadingId === proposal.id || !canGeneratePdf(proposal)
                }
              >
                {downloadingId === proposal.id ? (
                  <Loader size="sm" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
              </Button>

              {/* Emitir NF — so faz sentido em proposta ganha. Uma proposta
                  mista gera duas notas: NF-e da mercadoria e NFS-e da mao de obra. */}
              {isProposalApproved(proposal) && canIssueInvoice && (
                <IssueInvoiceButton
                  source="proposal"
                  sourceId={proposal.id}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                />
              )}

              {/* Editar PDF */}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                  title={
                    proposal.status === "draft"
                      ? "Rascunhos não podem ter PDF editado"
                      : canGeneratePdf(proposal)
                        ? "Editar PDF"
                        : "Preencha título, cliente e produtos para editar o PDF"
                  }
                  disabled={!canGeneratePdf(proposal)}
                  onClick={() =>
                    canGeneratePdf(proposal) &&
                    router.push(`/proposals/${proposal.id}/edit-pdf`)
                  }
                >
                  <Palette className="w-4 h-4" />
                </Button>
              )}

              {/* Editar */}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Editar"
                  onClick={() => handleEdit(proposal.id)}
                  disabled={editingId === proposal.id}
                >
                  {editingId === proposal.id ? (
                    <Loader size="sm" />
                  ) : (
                    <Pencil className="w-4 h-4" />
                  )}
                </Button>
              )}

              {/* Excluir */}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                  title="Excluir"
                  onClick={() => setDeleteId(proposal.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}

              {/* Dropdown with extra actions (Compartilhar, Duplicar, Anexos) — large screens */}
              <ProposalActionsDropdown
                proposal={proposal}
                canEdit={canEdit}
                canCreate={canCreate}
                canGeneratePdf={canGeneratePdf(proposal)}
                isSharing={sharingId === proposal.id}
                isDuplicating={duplicatingId === proposal.id}
                onShare={() => handleShare(proposal)}
                onDuplicate={() => handleDuplicate(proposal.id)}
                onAttachments={() => setAttachmentsProposalId(proposal.id)}
              />
            </div>

            {/* Compact dropdown with ALL actions — visible only on small screens (≤1700px) */}
            <div className="flex min-[1701px]:hidden">
              <ProposalActionsDropdown
                proposal={proposal}
                canEdit={canEdit}
                canCreate={canCreate}
                canDelete={canDelete}
                canGeneratePdf={canGeneratePdf(proposal)}
                isSharing={sharingId === proposal.id}
                isDuplicating={duplicatingId === proposal.id}
                isDownloading={downloadingId === proposal.id}
                isEditing={editingId === proposal.id}
                onShare={() => handleShare(proposal)}
                onDuplicate={() => handleDuplicate(proposal.id)}
                onAttachments={() => setAttachmentsProposalId(proposal.id)}
                showAllActions
                onViewPdf={() => router.push(`/proposals/${proposal.id}/view`)}
                onDownloadPdf={() => handleDownload(proposal)}
                onEditPdf={() =>
                  router.push(`/proposals/${proposal.id}/edit-pdf`)
                }
                onEdit={() => handleEdit(proposal.id)}
                onDelete={() => setDeleteId(proposal.id)}
                canIssueInvoice={isProposalApproved(proposal)}
                isIssuingInvoice={issuingInvoiceId === proposal.id}
                onIssueInvoice={() =>
                  void issueInvoice("proposal", proposal.id)
                }
              />
            </div>
          </div>
        ),
      },
    ],
    [
      canEdit,
      canDelete,
      canIssueInvoice,
      canCreate,
      isProposalApproved,
      isReadOnly,
      issueInvoice,
      issuingInvoiceId,
      updatingStatusId,
      downloadingId,
      editingId,
      sharingId,
      duplicatingId,
      handleDuplicate,
      handleEdit,
      handleStatusChange,
      router,
      sortLabelsPtBr,
      getStatusColor,
      getStatusLabel,
      kanbanColumns,
      clientResponses,
    ],
  );

  const renderDialogs = () => (
    <AlertDialog
      open={!!deleteId}
      onOpenChange={(open) => {
        if (!open) setDeleteId(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Proposta</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a proposta{" "}
            <strong>{proposalToDelete?.title}</strong>? Depois de excluir, você
            tem alguns segundos para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive hover:bg-destructive/90 gap-2"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // if (isPageLoading) {
  //   return (
  //     <>
  //       <ProposalsSkeleton />
  //       {renderDialogs()}
  //     </>
  //   );
  // }

  return (
    <>
      {!tenant && user?.role === "superadmin" ? (
        <SelectTenantState />
      ) : (
        <>
          {showFullPageSkeleton && <ProposalsSkeleton />}
          <div
            className={cn(
              "space-y-6 flex flex-col md:min-h-[calc(100vh-180px)]",
              showFullPageSkeleton && "hidden",
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Propostas
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie suas propostas comerciais
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {canViewCrm &&
                  (canAccessCrm ? (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="gap-2 w-full sm:w-auto"
                    >
                      <Link href="/crm?scope=proposals">
                        <Kanban className="w-5 h-5" />
                        CRM de Propostas
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="lg"
                      className="relative gap-2 pr-10 w-full sm:w-auto"
                      onClick={() =>
                        upgradeModal.showUpgradeModal(
                          "CRM",
                          "O módulo CRM pode ser contratado como add-on ou vem incluído no plano Enterprise.",
                          "enterprise",
                        )
                      }
                    >
                      <Kanban className="w-5 h-5" />
                      CRM de Propostas
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-1 ring-border/70">
                        <Crown
                          className="h-3 w-3"
                          style={{ color: premiumColor }}
                        />
                      </span>
                    </Button>
                  ))}

                {canCreate && (
                  <Button asChild size="lg" className="gap-2 w-full sm:w-auto">
                    <Link href="/proposals/new">
                      <Plus className="w-5 h-5" />
                      Nova Proposta
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Search */}
            {hasAnyProposals !== false && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="w-full sm:max-w-md sm:flex-1">
                  <Input
                    placeholder="Buscar por título, contato ou status..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    icon={
                      isFiltering && isLoading ? (
                        <Loader size="sm" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )
                    }
                  />
                </div>
                <div className="w-full sm:w-56">
                  <Select
                    aria-label="Filtrar por status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    disableSort
                  >
                    <option value="">Todos os status</option>
                    {statusFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            {isPageLoading ? (
              <ProposalsTableSkeleton />
            ) : hasAnyProposals === false ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhuma proposta encontrada
                  </h3>
                  <p className="text-muted-foreground text-center mb-6 max-w-md">
                    Crie sua primeira proposta comercial e comece a fechar
                    negócios!
                  </p>
                  {canCreate && (
                    <Link href="/proposals/new">
                      <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Criar Primeira Proposta
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : isFiltering && filteredProposals.length === 0 && !isLoading ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhum resultado encontrado
                  </h3>
                  <p className="text-muted-foreground text-center">
                    Tente buscar por outro termo.
                  </p>
                </CardContent>
              </Card>
            ) : isFiltering ? (
              <DataTable
                columns={columns}
                data={filteredProposals}
                keyExtractor={(proposal) => proposal.id}
                gridClassName="grid-cols-7"
                onSort={requestSort}
                sortConfig={sortConfig}
                minWidth="900px"
              />
            ) : (
              <DataTable
                columns={columns}
                keyExtractor={(proposal) => proposal.id}
                gridClassName="grid-cols-7"
                fetchPage={fetchPage}
                fetchEnabled={!!tenant && !isAwaitingPendingSave}
                onResetRef={resetRef}
                onRefreshRef={refreshRef}
                onUpdateItemsRef={updateItemsRef}
                batchSize={12}
                minWidth="900px"
                onSort={requestSort}
                sortConfig={sortConfig}
                onInitialLoadComplete={() => setAsyncDataReady(true)}
                onItemsChange={(items) => {
                  setProposals(items);
                }}
              />
            )}
          </div>
          {renderDialogs()}
          <ClientChangeRequestDialog
            proposalTitle={changeRequestTarget?.title?.trim() || "sem título"}
            request={changeRequestTarget?.clientChangeRequest ?? null}
            canDecide={canEdit && !isReadOnly}
            onClose={closeChangeRequest}
            onEdit={editForChangeRequest}
            onResolve={resolveChangeRequest}
          />
          <ClientAcceptanceDialog
            proposalTitle={acceptanceTarget?.title?.trim() || "sem título"}
            acceptance={acceptanceTarget?.clientAcceptance ?? null}
            canDecide={canEdit && !isReadOnly}
            onClose={closeAcceptance}
            onConfirm={confirmAcceptance}
            onAdjust={adjustAcceptance}
          />
          <SendProposalDialog
            target={sendTarget}
            companyName={tenant?.name}
            onClose={() => setSendTarget(null)}
          />
        </>
      )}

      <PdfDownloader
        proposal={proposals.find((p) => p.id === downloadingId) || null}
        tenant={tenant}
        isOpen={!!downloadingId}
        onClose={() => setDownloadingId(null)}
      />

      {/* Attachments Dialog */}
      {attachmentsProposalId &&
        (() => {
          const baseProposal = proposals.find(
            (p) => p.id === attachmentsProposalId,
          );
          if (!baseProposal) return null;
          const cachedAttachments = attachmentsCacheRef.current.get(
            attachmentsProposalId,
          );
          const proposalWithCachedAttachments = {
            ...baseProposal,
            attachments: cachedAttachments ?? baseProposal.attachments ?? [],
          };
          return (
            <ProposalAttachmentsDialog
              proposal={proposalWithCachedAttachments}
              isOpen={!!attachmentsProposalId}
              onClose={() => setAttachmentsProposalId(null)}
              onUpdate={(newAttachments) => {
                // Update cache to persist across fetchProposals
                attachmentsCacheRef.current.set(
                  attachmentsProposalId,
                  newAttachments,
                );
                // Update state
                setProposals((prev) =>
                  prev.map((p) =>
                    p.id === attachmentsProposalId
                      ? { ...p, attachments: newAttachments }
                      : p,
                  ),
                );
              }}
            />
          );
        })()}

      <FiscalGapsDialog gaps={fiscalGaps} onClose={closeFiscalGaps} />

      <ProposalInvoicePrompt {...invoicePrompt} />

      <UpgradeModal
        open={upgradeModal.isOpen}
        onOpenChange={upgradeModal.setIsOpen}
        feature={upgradeModal.feature}
        description={upgradeModal.description}
        requiredPlan={upgradeModal.requiredPlan}
      />
    </>
  );
}
