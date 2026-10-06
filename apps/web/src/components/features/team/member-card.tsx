"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Mail,
  Shield,
  ShieldOff,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
} from "lucide-react";
import { TeamMember } from "./team-types";
import { PermissionEditor } from "./permission-editor";
import { ApplyPermissionsDialog } from "./apply-permissions-dialog";
import type { MemberPermissions } from "@/lib/permissions/pages";
import {
  EditMemberModal,
  DeleteMemberDialog,
  ResetMfaDialog,
} from "./member-modals";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface MemberCardProps {
  member: TeamMember;
  /** Os outros membros: a origem de "Copiar de outro membro". */
  otherMembers: TeamMember[];
  onUpdatePermission: (
    memberId: string,
    pageId: string,
    key: string,
    value: boolean | string,
  ) => void;
  /** Depois de aplicar um perfil ou copiar, o mapa inteiro novo. */
  onPermissionsReplaced: (memberId: string, permissions: MemberPermissions) => void;
  saving: boolean;
  updatingKey: string | null;
  onRefresh: () => void;
}

export function MemberCard({
  member,
  otherMembers,
  onUpdatePermission,
  onPermissionsReplaced,
  saving,
  updatingKey,
  onRefresh,
}: MemberCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);
  const [showResetMfa, setShowResetMfa] = React.useState(false);
  const [showApply, setShowApply] = React.useState(false);
  const { hasFinancial } = usePlanLimits();

  return (
    <>
      <Card className="overflow-hidden">
        {/* Header */}
        {/* Identidade e ações não cabem na mesma linha num celular: o e-mail
            transbordava e as ações saíam do card. Abaixo de md a linha quebra. */}
        <div className="flex flex-wrap items-center gap-y-2 p-2 pr-2 md:pr-4 hover:bg-muted/10 transition-colors">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 basis-full md:basis-auto min-w-0 p-2 flex items-center justify-between cursor-pointer"
          >
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <span className="font-bold text-primary text-base md:text-lg">
                  {member.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate font-semibold">{member.name}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </p>
              </div>
            </div>
          </button>

          <div className="flex w-full shrink-0 items-center justify-end gap-3 md:w-auto">
            <Badge variant="secondary" className="gap-1">
              <Users className="w-3 h-3" />
              Membro
            </Badge>

            {/* Actions */}
            <div className="flex items-center gap-1 border-l pl-3 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-500 hover:text-blue-600"
                onClick={() => setShowEdit(true)}
              >
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-500 hover:text-amber-600"
                title="Resetar verificação em dois fatores"
                onClick={() => setShowResetMfa(true)}
              >
                <ShieldOff className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-500 hover:text-red-600"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <button onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Permissions Panel */}
        {isExpanded && (
          <div className="border-t bg-muted/20 p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <Shield className="w-4 h-4" />
                Permissões
              </h4>
              <Button variant="outline" size="sm" onClick={() => setShowApply(true)} className="w-full sm:w-auto">
                <Copy className="mr-2 h-4 w-4" />
                Aplicar perfil ou copiar
              </Button>
            </div>

            <PermissionEditor
              permissions={member.permissions}
              onChange={(pageId, key, value) => onUpdatePermission(member.id, pageId, key, value)}
              hasFinancial={hasFinancial}
              disabled={saving}
              busyKey={updatingKey?.startsWith(`${member.id}-`) ? updatingKey.slice(member.id.length + 1) : null}
            />

            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Alterações são salvas automaticamente
            </p>
          </div>
        )}
      </Card>

      <EditMemberModal
        member={member}
        open={showEdit}
        onOpenChange={setShowEdit}
        onSuccess={onRefresh}
      />
      <DeleteMemberDialog
        member={member}
        open={showDelete}
        onOpenChange={setShowDelete}
        onSuccess={onRefresh}
      />
      <ApplyPermissionsDialog
        member={member}
        otherMembers={otherMembers}
        hasFinancial={hasFinancial}
        open={showApply}
        onOpenChange={setShowApply}
        onApplied={(permissions) => onPermissionsReplaced(member.id, permissions)}
      />
      <ResetMfaDialog
        member={member}
        open={showResetMfa}
        onOpenChange={setShowResetMfa}
        onSuccess={onRefresh}
      />
    </>
  );
}
