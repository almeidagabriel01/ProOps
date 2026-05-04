import { Settings, Eye, UserPlus, Edit3, Trash2 } from "lucide-react";
import { StepNavigation } from "@/components/ui/step-wizard";
import { PermissionToggle } from "../permission-toggle";
import { AVAILABLE_PAGES, Permission } from "../team-types";

interface PermissionsStepProps {
  customPermissions: Record<string, Permission>;
  setCustomPermissions: React.Dispatch<
    React.SetStateAction<Record<string, Permission>>
  >;
  hasFinancial: boolean;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function PermissionsStep({
  customPermissions,
  setCustomPermissions,
  hasFinancial,
  onSubmit,
  isSubmitting,
}: PermissionsStepProps) {
  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
            <Settings className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Personalizar Permissões</h3>
            <p className="text-sm text-muted-foreground">
              Ajuste as permissões por página (opcional)
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b border-border/30">
            <p className="text-sm font-medium text-foreground">
              Permissões Detalhadas
            </p>
          </div>
          <div className="p-4 space-y-1 bg-card max-h-[400px] overflow-y-auto">
            {Object.entries(customPermissions).map(([page, perms]) => {
              const pageInfo = AVAILABLE_PAGES.find((p) => p.id === page);
              const pageName = pageInfo?.name || page;
              const isViewOnly = pageInfo?.viewOnly || false;

              // Skip Financial module if tenant doesn't have access
              if (
                (page === "wallet" || page === "transactions") &&
                !hasFinancial
              ) {
                return null;
              }

              return (
                <div
                  key={page}
                  className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm font-medium text-foreground">
                    {pageName}
                  </span>
                  <div className="flex gap-2">
                    <PermissionToggle
                      enabled={perms.canView}
                      onChange={(v) => {
                        setCustomPermissions((prev) => ({
                          ...prev,
                          [page]: {
                            ...prev[page],
                            canView: v,
                            canCreate: v ? prev[page].canCreate : false,
                            canEdit: v ? prev[page].canEdit : false,
                            canDelete: v ? prev[page].canDelete : false,
                          },
                        }));
                      }}
                      label="Ver"
                      icon={Eye}
                    />
                    {/* Only show create/edit/delete for non-viewOnly pages */}
                    {!isViewOnly && (
                      <>
                        <PermissionToggle
                          enabled={perms.canCreate || false}
                          onChange={(v) =>
                            setCustomPermissions((prev) => ({
                              ...prev,
                              [page]: { ...prev[page], canCreate: v },
                            }))
                          }
                          label="Criar"
                          icon={UserPlus}
                          disabled={!perms.canView}
                        />
                        <PermissionToggle
                          enabled={perms.canEdit || false}
                          onChange={(v) =>
                            setCustomPermissions((prev) => ({
                              ...prev,
                              [page]: { ...prev[page], canEdit: v },
                            }))
                          }
                          label="Editar"
                          icon={Edit3}
                          disabled={!perms.canView}
                        />
                        <PermissionToggle
                          enabled={perms.canDelete || false}
                          onChange={(v) =>
                            setCustomPermissions((prev) => ({
                              ...prev,
                              [page]: { ...prev[page], canDelete: v },
                            }))
                          }
                          label="Excluir"
                          icon={Trash2}
                          disabled={!perms.canView}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <StepNavigation
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Adicionar à Equipe"
      />
    </>
  );
}
