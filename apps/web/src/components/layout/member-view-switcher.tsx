"use client";

import * as React from "react";
import { ChevronDown, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader } from "@/components/ui/loader";
import { useTenant } from "@/providers/tenant-provider";
import { useViewingMember } from "@/providers/viewing-member-provider";
import { AdminService, type TenantMemberInfo } from "@/services/admin-service";
import { resolveMemberViewHome } from "@/lib/permissions/member-view";
import { toast } from "@/lib/toast";
import { hardRedirect } from "@/lib/auth/hard-redirect";
import { cn } from "@/lib/utils";

/**
 * "Ver como" da faixa do Acessar Painel: troca entre a visão da empresa (a do
 * dono) e a de cada membro, sem voltar ao /admin. A lista só é buscada quando
 * o menu abre.
 *
 * A troca recarrega a página: tudo que já está na tela foi lido com a
 * identidade anterior, e uma navegação do Next para a mesma rota (o membro
 * que também abre no Dashboard) manteria esses dados.
 */
export function MemberViewSwitcher() {
  const { tenant } = useTenant();
  const { member, setViewingMember, clearViewingMember } = useViewingMember();
  const [members, setMembers] = React.useState<TenantMemberInfo[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const tenantId = tenant?.id;

  React.useEffect(() => {
    setMembers(null);
  }, [tenantId]);

  const loadMembers = React.useCallback(() => {
    if (!tenantId || members || isLoading) return;
    setIsLoading(true);
    AdminService.getTenantMembers(tenantId)
      .then((list) => setMembers(list.filter((m) => !m.isOwner)))
      .catch(() => toast.error("Não foi possível carregar os membros desta empresa."))
      .finally(() => setIsLoading(false));
  }, [tenantId, members, isLoading]);

  const viewCompany = async () => {
    if (!member) return;
    await clearViewingMember({ reason: "switch" });
    hardRedirect("/dashboard");
  };

  const viewMember = async (next: TenantMemberInfo) => {
    if (member?.id === next.id) return;
    await setViewingMember(next);
    hardRedirect(resolveMemberViewHome(next));
  };

  return (
    <span className="shrink-0 [&>div]:mt-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={loadMembers}
            data-testid="member-view-switcher"
            aria-label="Ver o painel como um membro da equipe"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground max-md:min-h-9 max-md:px-1"
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Ver como</span>
            <ChevronDown className="h-3 w-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Ver o painel como
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => void viewCompany()}
            className={cn(!member && "font-semibold")}
          >
            Empresa (visão completa)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isLoading && (
            <div className="flex items-center justify-center py-3">
              <Loader size="sm" />
            </div>
          )}
          {!isLoading && members?.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Esta empresa ainda não tem membros na equipe.
            </p>
          )}
          {!isLoading &&
            members?.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => void viewMember(m)}
                className={cn("flex-col items-start", member?.id === m.id && "font-semibold")}
              >
                <span className="truncate">{m.name || m.email || "Sem nome"}</span>
                {m.email && (
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {m.email}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
