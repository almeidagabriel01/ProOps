"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader } from "@/components/ui/loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTenant } from "@/providers/tenant-provider";
import { useUpdatePermissions } from "@/hooks/useUpdatePermissions";
import {
  getAssignablePages,
  getDefaultPermissions,
  getPermissionPageName,
  type MemberPermissions,
  type RolePreset,
} from "@/lib/permissions/pages";
import { diffPermissions } from "@/lib/permissions/editor";
import { ROLE_PRESETS, type TeamMember } from "./team-types";

interface ApplyPermissionsDialogProps {
  member: TeamMember;
  /** Os outros membros, de quem dá para copiar as permissões. */
  otherMembers: TeamMember[];
  hasFinancial: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (permissions: MemberPermissions) => void;
}

type Source = { kind: "preset"; id: RolePreset } | { kind: "member"; id: string };

/**
 * Troca as permissões de um membro de uma vez: por um perfil pronto ou
 * copiando as de outro membro. Antes de gravar mostra o que muda, em valor
 * efetivo, para o dono não descobrir depois que tirou do vendedor uma tela
 * que ele usava.
 */
export function ApplyPermissionsDialog({
  member,
  otherMembers,
  hasFinancial,
  open,
  onOpenChange,
  onApplied,
}: ApplyPermissionsDialogProps) {
  const { tenant } = useTenant();
  const { updatePermissions, isLoading } = useUpdatePermissions();
  const [source, setSource] = React.useState<Source>({ kind: "preset", id: "viewer" });

  React.useEffect(() => {
    if (open) setSource({ kind: "preset", id: "viewer" });
  }, [open]);

  const pages = React.useMemo(() => getAssignablePages(hasFinancial), [hasFinancial]);
  const next: MemberPermissions = React.useMemo(() => {
    if (source.kind === "preset") return getDefaultPermissions(source.id, hasFinancial);
    const from = otherMembers.find((m) => m.id === source.id);
    const copy: MemberPermissions = {};
    for (const page of pages) copy[page.id] = from?.permissions[page.id] ?? { canView: false };
    return copy;
  }, [source, hasFinancial, otherMembers, pages]);

  const changes = diffPermissions(member.permissions, next, pages, (page) =>
    getPermissionPageName(page, tenant?.niche),
  );

  const value = source.kind === "preset" ? `preset:${source.id}` : `member:${source.id}`;

  const apply = async () => {
    if (await updatePermissions(member.id, next)) {
      onApplied(next);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trocar as permissões de {member.name}</DialogTitle>
          <DialogDescription>
            Escolha um perfil pronto ou copie as permissões de outra pessoa da equipe. Nada muda antes de você confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apply-permissions-source">A partir de</Label>
            <Select
              id="apply-permissions-source"
              value={value}
              onChange={(e) => {
                const [kind, id] = e.target.value.split(":");
                setSource(kind === "member" ? { kind: "member", id } : { kind: "preset", id: id as RolePreset });
              }}
              disableSort
            >
              {ROLE_PRESETS.map((preset) => (
                <option key={preset.id} value={`preset:${preset.id}`}>
                  Perfil: {preset.name}
                </option>
              ))}
              {otherMembers.map((other) => (
                <option key={other.id} value={`member:${other.id}`}>
                  Copiar de: {other.name}
                </option>
              ))}
            </Select>
            {source.kind === "preset" && (
              <p className="text-xs text-muted-foreground">
                {ROLE_PRESETS.find((preset) => preset.id === source.id)?.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {changes.length === 0
                ? "Nada muda: as permissões já são estas."
                : `${changes.length} ${changes.length === 1 ? "mudança" : "mudanças"}`}
            </p>
            {changes.length > 0 && (
              <ul
                className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm"
                aria-label="O que muda"
              >
                {changes.map((change) => (
                  <li key={change.label} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="min-w-0 flex-1">{change.label}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {change.from}
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium text-foreground">{change.to}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={() => void apply()} disabled={isLoading || changes.length === 0}>
            {isLoading && <Loader size="sm" variant="button" className="mr-2" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
