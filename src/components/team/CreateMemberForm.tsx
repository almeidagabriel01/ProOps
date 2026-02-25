"use client";

/**
 * Create Member Form
 *
 * This component allows MASTER users to create new team members (MEMBER users)
 * linked to their account. Uses the design system for consistent styling.
 */

import { useState } from "react";
import { FormCard } from "@/components/ui/form-card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Loader2,
  Eye,
  Edit3,
  Trash2,
  Shield,
  AlertCircle,
} from "lucide-react";
import {
  useCreateMember,
  getDefaultPermissions,
} from "@/hooks/useCreateMember";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { usePlanLimits } from "@/hooks/usePlanLimits";

// Pages that only support view (no create/edit/delete functionality)
const VIEW_ONLY_PAGES = ["dashboard"];

// Page display names for better UX
const PAGE_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  proposals: "Propostas",
  clients: "Clientes",
  products: "Produtos",
  services: "Serviços",
  financial: "Financeiro",
};

// Simple permission toggle component
function PermissionRow({
  page,
  permissions,
  onChange,
}: {
  page: string;
  permissions: {
    canView: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  };
  onChange: (page: string, key: string, value: boolean) => void;
}) {
  const isViewOnly = VIEW_ONLY_PAGES.includes(page);
  const displayName = PAGE_NAMES[page] || page.replace("/", "");

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <span className="font-medium text-sm">{displayName}</span>
      <div className="flex gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={permissions.canView}
            onChange={(e) => onChange(page, "canView", e.target.checked)}
            className="rounded border-input h-4 w-4 text-primary focus:ring-primary/20"
          />
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          Ver
        </label>
        {!isViewOnly && (
          <>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={permissions.canCreate ?? false}
                onChange={(e) => onChange(page, "canCreate", e.target.checked)}
                className="rounded border-input h-4 w-4 text-primary focus:ring-primary/20"
              />
              <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
              Criar
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={permissions.canEdit ?? false}
                onChange={(e) => onChange(page, "canEdit", e.target.checked)}
                className="rounded border-input h-4 w-4 text-primary focus:ring-primary/20"
              />
              <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
              Editar
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={permissions.canDelete ?? false}
                onChange={(e) => onChange(page, "canDelete", e.target.checked)}
                className="rounded border-input h-4 w-4 text-primary focus:ring-primary/20"
              />
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              Excluir
            </label>
          </>
        )}
      </div>
    </div>
  );
}

export function CreateMemberForm() {
  const { createMember, isLoading, error } = useCreateMember();
  const upgradeModal = useUpgradeModal();
  const { hasFinancial } = usePlanLimits();

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleType, setRoleType] = useState<"viewer" | "editor" | "admin">(
    "viewer",
  );
  const [permissions, setPermissions] = useState(
    getDefaultPermissions("viewer", hasFinancial),
  );

  // Update permissions when role type changes
  const handleRoleChange = (role: "viewer" | "editor" | "admin") => {
    setRoleType(role);
    setPermissions(getDefaultPermissions(role, hasFinancial));
  };

  // Update individual permission
  const handlePermissionChange = (
    page: string,
    key: string,
    value: boolean,
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [page]: {
        ...prev[page],
        [key]: value,
      },
    }));
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createMember({
      name,
      email,
      password: password || undefined,
      permissions,
    });

    if (result?.success) {
      // Reset form on success
      setName("");
      setEmail("");
      setPassword("");
      setRoleType("viewer");
      setPermissions(getDefaultPermissions("viewer", hasFinancial));
    } else if (
      result?.error &&
      ["resource-exhausted", "failed-precondition"].includes(result.error.code)
    ) {
      // Show upgrade modal for limit errors
      upgradeModal.showUpgradeModal(
        "Limite de Equipe Atingido",
        "Você atingiu o limite de membros do seu plano atual. Faça upgrade para adicionar mais pessoas à sua equipe.",
        "pro",
      );
    }
  };

  const roleOptions = [
    {
      id: "viewer",
      label: "👁️ Visualizador",
      description: "Apenas visualização",
    },
    { id: "editor", label: "✏️ Editor", description: "Pode criar e editar" },
    { id: "admin", label: "🛡️ Administrador", description: "Acesso completo" },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto">
      <FormCard
        title="Adicionar Membro da Equipe"
        description="Convide novos membros para colaborar"
        icon={UserPlus}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <FormField label="Nome Completo" htmlFor="name" required>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              required
              minLength={2}
            />
          </FormField>

          {/* Email Input */}
          <FormField label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@empresa.com"
              required
            />
          </FormField>

          {/* Password Input */}
          <FormField
            label="Senha Inicial"
            htmlFor="password"
            required
            hint="O membro poderá alterar depois"
          >
            <Input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Defina uma senha provisória"
              required
              minLength={6}
              className="bg-primary/5 border-primary/20"
            />
          </FormField>

          {/* Role Type Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              Tipo de Acesso
            </label>
            <div className="flex gap-3">
              {roleOptions.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleChange(role.id)}
                  className={`
                                        flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-sm
                                        ${
                                          roleType === role.id
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-muted/50 text-foreground hover:bg-muted border border-border"
                                        }
                                    `}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Permissões por Página</label>
            <div className="rounded-xl border border-border p-4 bg-muted/20">
              {Object.entries(permissions)
                .filter(([page]) => page !== "financial" || hasFinancial)
                .map(([page, perms]) => (
                  <PermissionRow
                    key={page}
                    page={page}
                    permissions={perms}
                    onChange={handlePermissionChange}
                  />
                ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Membro
              </>
            )}
          </Button>
        </form>
      </FormCard>

      <UpgradeModal
        open={upgradeModal.isOpen}
        onOpenChange={upgradeModal.setIsOpen}
        feature={upgradeModal.feature}
        description={upgradeModal.description}
        requiredPlan={upgradeModal.requiredPlan}
      />
    </div>
  );
}
