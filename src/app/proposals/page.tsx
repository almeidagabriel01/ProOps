"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Proposal, ProposalStatus, ProposalAttachment } from "@/types/proposal";
import { ProposalActionsDropdown } from "@/components/features/proposal/proposal-actions-dropdown";
import { ProposalAttachmentsDialog } from "@/components/features/proposal/proposal-attachments-dialog";
import { useTenant } from "@/providers/tenant-provider";
import {
  Plus,
  FileText,
  Search,
  ChevronDown,
  Loader2,
  Check,
  Send,
  XCircle,
  Clock,
  Copy,
  Eye,
  FileDown,
  Trash2,
  Palette,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProposalsSkeleton } from "./_components/proposals-skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "react-toastify";
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

const statusConfig: Record<
  ProposalStatus,
  { label: string; variant: "default" | "success" | "warning" | "destructive" }
> = {
  draft: { label: "Rascunho", variant: "default" },
  in_progress: { label: "Em Aberto", variant: "default" },
  sent: { label: "Enviada", variant: "warning" },
  approved: { label: "Aprovada", variant: "success" },
  rejected: { label: "Rejeitada", variant: "destructive" },
};

const statusOptions: {
  value: ProposalStatus;
  label: string;
  icon: typeof Clock;
}[] = [
  // { value: "draft", label: "Rascunho", icon: Clock }, // Draft is auto-save only
  { value: "in_progress", label: "Em Aberto", icon: Clock },
  { value: "sent", label: "Enviada", icon: Send },
  { value: "approved", label: "Aprovada", icon: Check },
  { value: "rejected", label: "Rejeitada", icon: XCircle },
];

import { ProposalService } from "@/services/proposal-service";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePdfGenerator } from "@/components/features/proposal/pdf/use-pdf-generator";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import { Tenant } from "@/types";
import { SharedProposalService } from "@/services/shared-proposal-service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { ProposalDefaults } from "@/lib/proposal-defaults";

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

    setIsOpen: (v) => !v && onClose(),
  });

  const template = React.useMemo(() => {
    if (!tenant) return null;
    return ProposalDefaults.createDefaultTemplate(
      tenant.id,
      tenant.name,
      tenant.primaryColor || "#2563eb",
    );
  }, [tenant]);

  React.useEffect(() => {
    if (isOpen && proposal && !isGenerating) {
      // Small timeout to ensure rendering is complete
      const timer = setTimeout(() => {
        handleGenerate("proposal-pdf-source-root");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, proposal, isGenerating, handleGenerate]);

  if (!proposal) return null;

  return (
    <div
      id="proposal-pdf-source-root"
      style={{
        position: "fixed",
        top: "-10000px",
        left: "-10000px",
        zIndex: -1,
        // Ensure container has width/height context for children
        width: "210mm",
        height: "auto",
      }}
    >
      <ProposalPdfViewer
        proposal={proposal}
        template={template}
        tenant={tenant}
        showCover={true}
        noMargins={true}
      />
    </div>
  );
}

export default function ProposalsPage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { canCreate, canEdit, canDelete } = usePagePermission("proposals");
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [updatingStatusId, setUpdatingStatusId] = React.useState<string | null>(
    null,
  );
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [sharingId, setSharingId] = React.useState<string | null>(null);
  const [shareLink, setShareLink] = React.useState<string | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
  const [attachmentsProposalId, setAttachmentsProposalId] = React.useState<
    string | null
  >(null);
  // Cache for attachments to prevent fetchProposals from overwriting local updates
  const attachmentsCacheRef = React.useRef<Map<string, ProposalAttachment[]>>(
    new Map(),
  );

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

  const handleShare = async (proposalId: string) => {
    setSharingId(proposalId);
    try {
      const result = await SharedProposalService.generateShareLink(proposalId);
      setShareLink(result.shareUrl);
      setIsShareDialogOpen(true);
      toast.success("Link gerado com sucesso!");
    } catch (error) {
      console.error("Error generating share link:", error);
      toast.error("Erro ao gerar link de compartilhamento");
    } finally {
      setSharingId(null);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success("Link copiado para a área de transferência!");
    }
  };

  // Filter proposals based on search term
  const filteredProposals = React.useMemo(() => {
    if (!searchTerm.trim()) return proposals;

    const term = searchTerm.toLowerCase();
    return proposals.filter(
      (proposal) =>
        proposal.title.toLowerCase().includes(term) ||
        proposal.clientName?.toLowerCase().includes(term) ||
        statusConfig[proposal.status as ProposalStatus]?.label
          .toLowerCase()
          .includes(term),
    );
  }, [proposals, searchTerm]);

  const isPageLoading = tenantLoading || isLoading;

  const fetchProposals = React.useCallback(async () => {
    if (tenant) {
      try {
        await ProposalService.waitForSave(); // Wait for any pending auto-saves
        // setIsLoading(true); // Optional: don't show full loading state on refresh to avoid flicker
        const data = await ProposalService.getProposals(tenant.id);

        // Sync client names from clients collection
        const clientIds = [
          ...new Set(data.filter((p) => p.clientId).map((p) => p.clientId)),
        ];

        if (clientIds.length > 0) {
          try {
            const { ClientService } = await import("@/services/client-service");
            const allClients = await ClientService.getClients(tenant.id);

            // Create a map for quick lookup
            const clientMap = new Map(allClients.map((c) => [c.id, c]));

            // Update proposals with fresh client data
            data.forEach((proposal) => {
              if (proposal.clientId && clientMap.has(proposal.clientId)) {
                const freshClient = clientMap.get(proposal.clientId)!;
                proposal.clientName = freshClient.name;
                proposal.clientEmail = freshClient.email;
                proposal.clientPhone = freshClient.phone;
                proposal.clientAddress = freshClient.address;
              }
            });
          } catch (clientError) {
            console.warn("Could not sync client names:", clientError);
          }
        }

        // Sort by createdAt descending (most recent first)
        data.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        setProposals(data);
      } catch (error) {
        console.error("Failed to fetch proposals", error);
      }
    }
    setIsLoading(false);
  }, [tenant]);

  // Initial fetch
  React.useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // Subscribe to updates (e.g. from auto-save)
  React.useEffect(() => {
    return ProposalService.subscribe(() => {
      console.log("Received proposal update notification, refreshing list...");
      setIsLoading(true); // Show loading skeleton while waiting/fetching
      fetchProposals();
    });
  }, [fetchProposals]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await ProposalService.deleteProposal(deleteId);
      setProposals((prev) => prev.filter((p) => p.id !== deleteId));
      toast.success("Proposta excluída com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir proposta");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
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

        const data = await ProposalService.getProposals(tenant.id);
        setProposals(data);
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
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleStatusChange = React.useCallback(
    async (proposalId: string, newStatus: ProposalStatus) => {
      const proposal = proposals.find((p) => p.id === proposalId);
      if (!proposal || proposal.status === newStatus) return;

      setUpdatingStatusId(proposalId);
      try {
        await ProposalService.updateProposal(proposalId, { status: newStatus });
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId ? { ...p, status: newStatus } : p,
          ),
        );
        toast.success(
          `Status alterado para "${statusConfig[newStatus].label}"`,
        );
      } catch (error) {
        console.error("Error updating status:", error);
        toast.error("Erro ao alterar status");
      } finally {
        setUpdatingStatusId(null);
      }
    },
    [proposals],
  );

  const proposalToDelete = proposals.find((p) => p.id === deleteId);
  const columns: DataTableColumn<Proposal>[] = React.useMemo(
    () => [
      {
        key: "title",
        header: "Título",
        render: (proposal) => {
          const productCount = proposal.products?.length || 0;
          const total =
            proposal.products?.reduce(
              (sum: number, p: { total: number }) => sum + p.total,
              0,
            ) || 0;
          return (
            <div>
              <Link
                href={`/proposals/${proposal.id}?initialStep=automation`}
                className="font-medium hover:underline"
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
        key: "client",
        header: "Contato",
        render: (proposal) => (
          <div className="text-sm text-muted-foreground truncate">
            {proposal.clientName}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (proposal) => (
          <div>
            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="focus:outline-none cursor-pointer"
                    disabled={updatingStatusId === proposal.id}
                  >
                    <Badge
                      variant={
                        statusConfig[proposal.status as ProposalStatus]
                          ?.variant || "default"
                      }
                      className="text-xs cursor-pointer hover:brightness-110 transition-all gap-1 pr-1.5 min-w-[100px] justify-start"
                    >
                      {updatingStatusId === proposal.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      {statusConfig[proposal.status as ProposalStatus]?.label ||
                        "Rascunho"}
                      <ChevronDown className="w-3 h-3 opacity-60 ml-1" />
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[140px]">
                  {statusOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = proposal.status === option.value;
                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() =>
                          handleStatusChange(proposal.id, option.value)
                        }
                        className={isActive ? "bg-muted" : ""}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {option.label}
                        {isActive && <Check className="w-4 h-4 ml-auto" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge
                variant={
                  statusConfig[proposal.status as ProposalStatus]?.variant ||
                  "default"
                }
              >
                {statusConfig[proposal.status as ProposalStatus]?.label ||
                  "Rascunho"}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "ambiente",
        header: "Ambiente",
        render: (proposal) => {
          const uniqueAmbientes = Array.from(
            new Set(
              proposal.sistemas?.map((s) => s.ambienteName).filter(Boolean),
            ),
          );
          return (
            <div className="text-sm text-muted-foreground truncate">
              {uniqueAmbientes.length > 0 ? (
                <span title={uniqueAmbientes.join(", ")}>
                  {uniqueAmbientes.length > 2
                    ? `${uniqueAmbientes.slice(0, 2).join(", ")} +${uniqueAmbientes.length - 2}`
                    : uniqueAmbientes.join(", ")}
                </span>
              ) : (
                "-"
              )}
            </div>
          );
        },
      },
      {
        key: "sistema",
        header: "Sistema",
        render: (proposal) => {
          const uniqueSistemas = Array.from(
            new Set(
              proposal.sistemas?.map((s) => s.sistemaName).filter(Boolean),
            ),
          );
          return (
            <div className="text-sm text-muted-foreground truncate">
              {uniqueSistemas.length > 0 ? (
                <span title={uniqueSistemas.join(", ")}>
                  {uniqueSistemas.length > 2
                    ? `${uniqueSistemas.slice(0, 2).join(", ")} +${uniqueSistemas.length - 2}`
                    : uniqueSistemas.join(", ")}
                </span>
              ) : (
                "-"
              )}
            </div>
          );
        },
      },
      {
        key: "validity",
        header: "Validade",
        render: (proposal) => (
          <div className="text-sm text-muted-foreground">
            {formatDate(proposal.validUntil)}
          </div>
        ),
      },
      {
        key: "actions",
        header: "Ações",
        className: "text-right",
        headerClassName: "text-right",
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
              </Button>

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
                    <Loader2 className="w-4 h-4 animate-spin" />
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
                onShare={() => handleShare(proposal.id)}
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
                onShare={() => handleShare(proposal.id)}
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
              />
            </div>
          </div>
        ),
      },
    ],
    [
      canEdit,
      canDelete,
      canCreate,
      updatingStatusId,
      downloadingId,
      editingId,
      sharingId,
      duplicatingId,
      handleDuplicate,
      handleEdit,
      handleStatusChange,
      router,
    ],
  );

  const renderDialogs = () => (
    <AlertDialog
      open={!!deleteId}
      onOpenChange={(open) => {
        if (!isDeleting) {
          if (!open) setDeleteId(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Proposta</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a proposta{" "}
            <strong>{proposalToDelete?.title}</strong>? Esta ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive hover:bg-destructive/90 gap-2"
            disabled={isDeleting}
          >
            {isDeleting && <Spinner className="w-4 h-4 text-white" />}
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isPageLoading) {
    return (
      <>
        <ProposalsSkeleton />
        {renderDialogs()}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Propostas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas propostas comerciais
            </p>
          </div>
          {canCreate && (
            <Link href="/proposals/new">
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Novo Proposta
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        {proposals.length > 0 && (
          <div className="max-w-md">
            <Input
              placeholder="Buscar por título, contato ou status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        )}

        {proposals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma proposta encontrada
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Crie sua primeira proposta comercial e comece a fechar negócios!
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
        ) : filteredProposals.length === 0 ? (
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
        ) : (
          <DataTable
            columns={columns}
            data={filteredProposals}
            keyExtractor={(proposal) => proposal.id}
            gridClassName="grid-cols-7"
          />
        )}
      </div>
      {renderDialogs()}

      <PdfDownloader
        proposal={proposals.find((p) => p.id === downloadingId) || null}
        tenant={tenant}
        isOpen={!!downloadingId}
        onClose={() => setDownloadingId(null)}
      />

      {/* Share Link Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar Proposta</DialogTitle>
            <DialogDescription>
              Copie o link abaixo para compartilhar esta proposta com seu
              cliente. O link é válido por 30 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                id="share-link"
                value={shareLink || ""}
                readOnly
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              size="icon"
              onClick={handleCopyLink}
              title="Copiar link"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
