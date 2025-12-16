"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Proposal, ProposalStatus } from "@/services/proposal-service";
import { useTenant } from "@/providers/tenant-provider";
import {
  Plus,
  FileText,
  Copy,
  Trash2,
  Eye,
  MoreHorizontal,
} from "lucide-react";

const statusConfig: Record<
  ProposalStatus,
  { label: string; variant: "default" | "success" | "warning" | "destructive" }
> = {
  draft: { label: "Rascunho", variant: "default" },
  sent: { label: "Enviada", variant: "warning" },
  approved: { label: "Aprovada", variant: "success" },
  rejected: { label: "Rejeitada", variant: "destructive" },
};

import { ProposalService } from "@/services/proposal-service";

import { usePagePermission } from "@/hooks/usePagePermission";

export default function ProposalsPage() {
  const { tenant } = useTenant();
  const { canCreate, canDelete } = usePagePermission("proposals");
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProposals = async () => {
      if (tenant) {
        try {
          const data = await ProposalService.getProposals(tenant.id);
          setProposals(data);
        } catch (error) {
          console.error("Failed to fetch proposals", error);
        }
      }
      setIsLoading(false);
    };
    fetchProposals();
  }, [tenant]);

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta proposta?")) {
      try {
        await ProposalService.deleteProposal(id);
        setProposals((prev) => prev.filter((p) => p.id !== id));
      } catch (error) {
        alert("Erro ao excluir proposta");
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const original = proposals.find((p) => p.id === id);
      if (!original) return;

      // Create a copy without ID and with updated title
      const { id: _, ...rest } = original;
      const newProposal = await ProposalService.createProposal({
        ...rest,
        title: `${original.title} (Cópia)`,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setProposals((prev) => [...prev, newProposal]);
    } catch (error) {
      console.error("Error duplicating proposal:", error);
      alert("Erro ao duplicar proposta");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
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
              Nova Proposta
            </Button>
          </Link>
        )}
      </div>

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
      ) : (
        <div className="grid gap-4">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
            <div className="col-span-4">Título</div>
            <div className="col-span-2">Cliente</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Criado em</div>
            <div className="col-span-2 text-right">Ações</div>
          </div>

          {/* Rows */}
          {proposals.map((proposal) => {
            const status = statusConfig[proposal.status];
            const productCount = proposal.products?.length || 0;
            const total =
              proposal.products?.reduce((sum, p) => sum + p.total, 0) || 0;
            return (
              <Card
                key={proposal.id}
                className="hover:bg-muted/50 transition-colors"
              >
                <CardContent className="grid grid-cols-12 gap-4 items-center py-4 px-4">
                  <div className="col-span-4">
                    <Link
                      href={`/proposals/${proposal.id}/view`}
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
                  <div className="col-span-2 text-sm text-muted-foreground truncate">
                    {proposal.clientName}
                  </div>
                  <div className="col-span-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {formatDate(proposal.createdAt)}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <Link href={`/proposals/${proposal.id}/view`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Ver PDF"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={`/proposals/${proposal.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </Link>
                    {canCreate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDuplicate(proposal.id)}
                        title="Duplicar"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(proposal.id)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
