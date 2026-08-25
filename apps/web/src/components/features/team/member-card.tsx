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
} from "lucide-react";
import { TeamMember, AVAILABLE_PAGES } from "./team-types";
import { PagePermissionRow } from "./page-permission-row";
import {
  EditMemberModal,
  DeleteMemberDialog,
  ResetMfaDialog,
} from "./member-modals";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface MemberCardProps {
  member: TeamMember;
  onUpdatePermission: (
    memberId: string,
    pageId: string,
    key: string,
    value: boolean,
  ) => void;
  saving: boolean;
  updatingKey: string | null;
  onRefresh: () => void;
}

export function MemberCard({
  member,
  onUpdatePermission,
  saving,
  updatingKey,
  onRefresh,
}: MemberCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);
  const [showResetMfa, setShowResetMfa] = React.useState(false);
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
            <h4 className="font-medium mb-4 flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4" />
              Permissões por página
            </h4>

            <div className="space-y-2">
              {AVAILABLE_PAGES.map((page) => {
                // Hide financial permission if tenant doesn't have it
                if (page.id === "financial" && !hasFinancial) return null;

                return (
                  <PagePermissionRow
                    key={page.id}
                    page={page}
                    permission={
                      member.permissions[page.id] || { canView: false }
                    }
                    onUpdate={(key, value) =>
                      onUpdatePermission(member.id, page.id, key, value)
                    }
                    saving={saving}
                    updatingKey={updatingKey}
                    memberId={member.id}
                  />
                );
              })}
            </div>

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
      <ResetMfaDialog
        member={member}
        open={showResetMfa}
        onOpenChange={setShowResetMfa}
        onSuccess={onRefresh}
      />
    </>
  );
}
