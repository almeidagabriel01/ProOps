import { Shield, Check } from "lucide-react";
import { StepNavigation } from "@/components/ui/step-wizard";
import { roleConfig } from "../team-constants";
import { ROLE_PRESETS } from "../team-types";

interface RoleSelectionStepProps {
  selectedRole: string;
  onSelectRole: (roleId: string) => void;
}

export function RoleSelectionStep({
  selectedRole,
  onSelectRole,
}: RoleSelectionStepProps) {
  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Nível de Acesso</h3>
            <p className="text-sm text-muted-foreground">
              Escolha o perfil de permissões base
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ROLE_PRESETS.map((role) => {
            const config = roleConfig[role.id as keyof typeof roleConfig];
            const RoleIcon = config.icon;
            const isSelected = selectedRole === role.id;

            return (
              <button
                key={role.id}
                type="button"
                onClick={() => onSelectRole(role.id)}
                className={`
                                        relative p-5 rounded-xl border-2 text-left transition-all duration-300 group cursor-pointer
                                        ${
                                          isSelected
                                            ? `${config.borderColor} ${config.lightBg} shadow-lg`
                                            : "border-border/50 bg-card hover:border-border hover:shadow-md"
                                        }
                                    `}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center shadow-md`}
                  >
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`
                                        w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all
                                        ${
                                          isSelected
                                            ? `bg-linear-to-br ${config.color} text-white shadow-lg`
                                            : `${config.lightBg} ${config.textColor} group-hover:scale-110`
                                        }
                                    `}
                >
                  <RoleIcon className="w-6 h-6" />
                </div>

                <p
                  className={`font-bold ${isSelected ? config.textColor : "text-foreground"}`}
                >
                  {role.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {role.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <StepNavigation />
    </>
  );
}
