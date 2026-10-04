"use client";

import * as React from "react";
import { Eye, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { AdminService, type TenantMemberInfo } from "@/services/admin-service";
import { formatDateBR } from "@/utils/date-format";
import { toast } from "@/lib/toast";

interface TenantMembersDialogProps {
  tenantId: string | null;
  tenantName: string;
  onClose: () => void;
  /** Dono: abre o Acessar Painel normal. */
  onViewCompany: () => void;
  onViewAsMember: (member: TenantMemberInfo) => void;
}

function roleLabel(member: TenantMemberInfo): string {
  if (member.isOwner) return "Dono";
  if (member.role === "MEMBER") return "Membro";
  if (member.role === "ADMIN" || member.role === "MASTER" || member.role === "WK") {
    return "Administrador";
  }
  return member.role.toLowerCase();
}

function visiblePagesCount(member: TenantMemberInfo): number {
  return Object.entries(member.permissions ?? {}).filter(
    ([pageId, perm]) => pageId !== "profile" && perm.canView,
  ).length;
}

/**
 * Pessoas de uma empresa, para o superadmin abrir o painel como um membro
 * ("Ver como membro"). A visão do membro é sempre somente leitura.
 */
export function TenantMembersDialog({
  tenantId,
  tenantName,
  onClose,
  onViewCompany,
  onViewAsMember,
}: TenantMembersDialogProps) {
  const [members, setMembers] = React.useState<TenantMemberInfo[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setMembers(null);
    setIsLoading(true);
    AdminService.getTenantMembers(tenantId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Erro ao carregar os membros da empresa.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <Dialog open={Boolean(tenantId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Membros da equipe</DialogTitle>
          <DialogDescription>
            {tenantName}: abra o painel exatamente como cada pessoa vê, só para leitura.
          </DialogDescription>
        </DialogHeader>

        {isLoading && !members ? (
          <div className="flex justify-center py-10">
            <Loader size="md" />
          </div>
        ) : members && members.length > 0 ? (
          <ul className="divide-y rounded-lg border" data-testid="tenant-members-list">
            {members.map((member) => {
              const pages = visiblePagesCount(member);
              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {member.name || member.email || "Sem nome"}
                      </span>
                      <Badge variant={member.isOwner ? "default" : "secondary"} className="shrink-0">
                        {roleLabel(member)}
                      </Badge>
                    </div>
                    {member.email && (
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {member.role === "MEMBER" && !member.isOwner
                        ? `Vê ${pages} ${pages === 1 ? "tela" : "telas"}`
                        : "Vê a empresa inteira"}
                      {member.createdAt && ` · desde ${formatDateBR(member.createdAt)}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => (member.isOwner ? onViewCompany() : onViewAsMember(member))}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {member.isOwner ? "Acessar Painel" : "Ver como"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : members ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 opacity-30" />
            Esta empresa ainda não tem pessoas cadastradas.
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
