"use client";

import {
    Eye,
    EyeOff,
    Edit3,
    Trash2,
    UserPlus,
} from "lucide-react";
import { Permission, AVAILABLE_PAGES } from "./team-types";
import { PermissionToggle } from "./permission-toggle";

interface PagePermissionRowProps {
    page: typeof AVAILABLE_PAGES[0];
    permission: Permission;
    onUpdate: (key: string, value: boolean) => void;
    saving: boolean;
    updatingKey: string | null;
    memberId: string;
}

export function PagePermissionRow({
    page,
    permission,
    onUpdate,
    saving,
    updatingKey,
    memberId,
}: PagePermissionRowProps) {
    const canView = permission?.canView ?? false;
    const canEdit = permission?.canEdit ?? false;

    const isUpdating = (key: string) => updatingKey === `${memberId}-${page.id}-${key}`;

    // Abaixo de sm a identificação fica em cima e os toggles embaixo, numa grade
    // de 2 colunas. Lado a lado, o texto era espremido a uma palavra por linha e
    // os botões passavam por cima.
    return (
        <div className={`
      flex flex-col gap-3 p-3 sm:p-4 rounded-xl border transition-all duration-200
      sm:flex-row sm:items-center sm:justify-between
      ${canView
                ? "bg-card border-border"
                : "bg-muted/30 border-transparent"
            }
    `}>
            <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${canView ? "bg-primary/10" : "bg-muted"}
        `}>
                    {canView ? (
                        <Eye className="w-5 h-5 text-primary" />
                    ) : (
                        <EyeOff className="w-5 h-5 text-muted-foreground" />
                    )}
                </div>

                <div className="min-w-0">
                    <p className={`truncate font-medium ${!canView && "text-muted-foreground"}`}>
                        {page.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {canView
                            ? (canEdit ? "Pode ver e editar" : "Apenas visualização")
                            : "Sem acesso a esta página"
                        }
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:items-center sm:justify-end">
                <PermissionToggle
                    enabled={canView}
                    onChange={(v) => onUpdate("canView", v)}
                    label="Ver"
                    icon={Eye}
                    disabled={saving}
                    loading={isUpdating("canView")}
                />
                {/* Only show create/edit/delete for non-viewOnly pages */}
                {!page.viewOnly && (
                    <>
                        <PermissionToggle
                            enabled={permission?.canCreate ?? false}
                            onChange={(v) => onUpdate("canCreate", v)}
                            label="Criar"
                            icon={UserPlus}
                            disabled={saving || !canView}
                            loading={isUpdating("canCreate")}
                        />
                        <PermissionToggle
                            enabled={canEdit}
                            onChange={(v) => onUpdate("canEdit", v)}
                            label="Editar"
                            icon={Edit3}
                            disabled={saving || !canView}
                            loading={isUpdating("canEdit")}
                        />
                        <PermissionToggle
                            enabled={permission?.canDelete ?? false}
                            onChange={(v) => onUpdate("canDelete", v)}
                            label="Excluir"
                            icon={Trash2}
                            disabled={saving || !canView}
                            loading={isUpdating("canDelete")}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
