import { Settings } from "lucide-react";
import { StepNavigation } from "@/components/ui/step-wizard";
import { Permission } from "../team-types";
import { PermissionEditor } from "../permission-editor";
import { applyPermissionChange } from "@/lib/permissions/editor";

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
              Ajuste o que o perfil escolhido entregou (opcional)
            </p>
          </div>
        </div>

        <PermissionEditor
          permissions={customPermissions}
          onChange={(pageId, key, value) =>
            setCustomPermissions((prev) => ({
              ...prev,
              [pageId]: applyPermissionChange(pageId, prev[pageId], key, value),
            }))
          }
          hasFinancial={hasFinancial}
        />
      </div>

      <StepNavigation
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Adicionar à Equipe"
      />
    </>
  );
}
