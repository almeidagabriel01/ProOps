"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { FormGroup, FormItem } from "@/components/ui/form-components";
import {
  StepWizard,
  StepNavigation,
  StepCard,
} from "@/components/ui/step-wizard";
import {
  UserPlus,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  AlertCircle,
  Shield,
  Mail,
  Lock,
  User,
  Check,
  Settings,
} from "lucide-react";
import {
  useCreateMember,
  getDefaultPermissions,
} from "@/hooks/useCreateMember";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { ROLE_PRESETS, AVAILABLE_PAGES } from "./team-types";
import { PermissionToggle } from "./permission-toggle";

interface CreateMemberSectionProps {
  onSuccess: () => void;
}

const roleConfig = {
  viewer: {
    icon: Eye,
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-500",
    lightBg: "bg-blue-500/10",
    borderColor: "border-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  editor: {
    icon: Edit3,
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-500",
    lightBg: "bg-amber-500/10",
    borderColor: "border-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  admin: {
    icon: Shield,
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-500",
    lightBg: "bg-purple-500/10",
    borderColor: "border-purple-500",
    textColor: "text-purple-600 dark:text-purple-400",
  },
};

const steps = [
  {
    id: "info",
    title: "Informações",
    description: "Dados do membro",
    icon: User,
  },
  {
    id: "role",
    title: "Nível de Acesso",
    description: "Permissões base",
    icon: Shield,
  },
  {
    id: "permissions",
    title: "Personalizar",
    description: "Ajustes finos",
    icon: Settings,
  },
];

export function CreateMemberSection({ onSuccess }: CreateMemberSectionProps) {
  const { createMember, isLoading, error } = useCreateMember();
  const upgradeModal = useUpgradeModal();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [selectedRole, setSelectedRole] = React.useState<string>("viewer");
  const [customPermissions, setCustomPermissions] = React.useState(
    getDefaultPermissions("viewer")
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = React.useState(false);

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setCustomPermissions(getDefaultPermissions(roleId as keyof typeof roleConfig));
  };

  const handleSubmit = async () => {
    const result = await createMember({
      name,
      email,
      password: password || undefined,
      permissions: customPermissions,
    });

    if (result?.success) {
      setName("");
      setEmail("");
      setPassword("");
      setSelectedRole("viewer");
      setCustomPermissions(getDefaultPermissions("viewer"));
      onSuccess();
    } else if (result?.error && ['resource-exhausted', 'failed-precondition'].includes(result.error.code)) {
      // Show upgrade modal for limit errors
      upgradeModal.showUpgradeModal(
        "Limite de Equipe Atingido",
        "Você atingiu o limite de membros do seu plano atual. Faça upgrade para adicionar mais pessoas à sua equipe.",
        "pro"
      );
    }
  };

  // Limpar erros automaticamente quando os campos mudam
  React.useEffect(() => {
    if (name && name.trim().length >= 2 && errors.name) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.name;
        return newErrors;
      });
    }
  }, [name, errors.name]);

  React.useEffect(() => {
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && errors.email) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  }, [email, errors.email]);

  React.useEffect(() => {
    if (password && password.length >= 6 && errors.password) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      });
    }
  }, [password, errors.password]);

  // Validação do Step 1 (Informações)
  const validateStep1 = (): boolean => {
    let isValid = true;
    const newErrors: Record<string, string> = {};

    if (!name || name.trim().length < 2) {
      newErrors.name = "Nome deve ter pelo menos 2 caracteres";
      isValid = false;
    }

    if (!email || !email.trim()) {
      newErrors.email = "Email é obrigatório";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email inválido";
      isValid = false;
    }

    if (!password || password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };



  return (
    <div className="relative rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-primary/10 to-transparent rounded-full -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-linear-to-tr from-primary/10 to-transparent rounded-full translate-y-24 -translate-x-24" />

      <div className="relative p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
            <UserPlus className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Adicionar Novo Membro
            </h2>
            <p className="text-muted-foreground">
              Convide alguém para colaborar na sua equipe
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-in shake duration-200 mb-6">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <StepWizard steps={steps}>
          {/* Step 1: Informações do Membro */}
          <StepCard>
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Informações do Membro
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Nome, email e senha inicial
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <FormGroup>
                  <FormItem
                    label="Nome Completo"
                    htmlFor="member-name"
                    required
                    error={errors.name}
                  >
                    <Input
                      id="member-name"
                      name="member_name_new"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Maria Silva"
                      icon={<User className="w-4 h-4" />}
                      required
                      minLength={2}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className={errors.name ? "border-destructive" : ""}
                    />
                  </FormItem>

                  <FormItem
                    label="Email"
                    htmlFor="member-email"
                    required
                    error={errors.email}
                  >
                    <Input
                      id="member-email"
                      name="member_email_new"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="maria@empresa.com"
                      icon={<Mail className="w-4 h-4" />}
                      required
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className={errors.email ? "border-destructive" : ""}
                    />
                  </FormItem>
                </FormGroup>

                <FormItem
                  label="Senha Inicial"
                  htmlFor="member-password"
                  required
                  hint="O membro poderá alterá-la depois"
                  error={errors.password}
                >
                  <div className="relative">
                    <Input
                      id="member-password"
                      name="member_password_new"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Defina uma senha provisória"
                      icon={<Lock className="w-4 h-4" />}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      data-1p-ignore
                      data-lpignore="true"
                      className={
                        errors.password
                          ? "border-destructive pr-10"
                          : "bg-primary/5 border-primary/20 focus:bg-background pr-10"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </FormItem>
              </div>
            </div>
            <StepNavigation onBeforeNext={validateStep1} />
          </StepCard>

          {/* Step 2: Nível de Acesso */}
          <StepCard>
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
                      onClick={() => handleRoleSelect(role.id)}
                      className={`
                                                relative p-5 rounded-xl border-2 text-left transition-all duration-300 group cursor-pointer
                                                ${isSelected
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
                                                ${isSelected
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
          </StepCard>

          {/* Step 3: Personalizar Permissões */}
          <StepCard>
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Personalizar Permissões
                  </h3>
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
                    const pageInfo = AVAILABLE_PAGES.find(p => p.id === page);
                    const pageName = pageInfo?.name || page;
                    const isViewOnly = pageInfo?.viewOnly || false;

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
              onSubmit={handleSubmit}
              isSubmitting={isLoading}
              submitLabel="Adicionar à Equipe"
            />
          </StepCard>
        </StepWizard>

        <p className="text-xs text-center text-muted-foreground mt-6">
          O novo membro poderá fazer login com o email e senha definidos.
        </p>

        <UpgradeModal
          open={upgradeModal.isOpen}
          onOpenChange={upgradeModal.setIsOpen}
          feature={upgradeModal.feature}
          description={upgradeModal.description}
          requiredPlan={upgradeModal.requiredPlan}
        />
      </div>
    </div>
  );
}
