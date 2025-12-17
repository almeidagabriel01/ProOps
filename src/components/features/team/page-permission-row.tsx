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
}

export function PagePermissionRow({
    page,
    permission,
    onUpdate,
    saving,
}: PagePermissionRowProps) {
    const canView = permission?.canView ?? false;
    const canEdit = permission?.canEdit ?? false;

    return (
        <div className={`
      flex items-center justify-between p-4 rounded-xl border transition-all duration-200
      ${canView
                ? "bg-card border-border"
                : "bg-muted/30 border-transparent"
            }
    `}>
            <div className="flex items-center gap-3">
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

                <div>
                    <p className={`font-medium ${!canView && "text-muted-foreground"}`}>
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

            <div className="flex items-center gap-2">
                <PermissionToggle
                    enabled={canView}
                    onChange={(v) => onUpdate("canView", v)}
                    label="Ver"
                    icon={Eye}
                    disabled={saving}
                />
                <PermissionToggle
                    enabled={permission?.canCreate ?? false}
                    onChange={(v) => onUpdate("canCreate", v)}
                    label="Criar"
                    icon={UserPlus}
                    disabled={saving || !canView}
                />
                <PermissionToggle
                    enabled={canEdit}
                    onChange={(v) => onUpdate("canEdit", v)}
                    label="Editar"
                    icon={Edit3}
                    disabled={saving || !canView}
                />
                <PermissionToggle
                    enabled={permission?.canDelete ?? false}
                    onChange={(v) => onUpdate("canDelete", v)}
                    label="Excluir"
                    icon={Trash2}
                    disabled={saving || !canView}
                />
            </div>
        </div>
    );
}
