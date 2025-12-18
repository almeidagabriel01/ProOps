"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
    FormSection,
    FormGroup,
    FormItem,
} from "@/components/ui/form-components";
import {
    UserPlus,
    Loader2,
    Eye,
    Edit3,
    Trash2,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Shield,
    Mail,
    Lock,
    User,
    Check,
} from "lucide-react";
import { useCreateMember, getDefaultPermissions } from "@/hooks/useCreateMember";
import { ROLE_PRESETS } from "./team-types";
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

export function CreateMemberSection({ onSuccess }: CreateMemberSectionProps) {
    const { createMember, isLoading, error } = useCreateMember();
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [selectedRole, setSelectedRole] = React.useState<string>("viewer");
    const [customPermissions, setCustomPermissions] = React.useState(getDefaultPermissions("viewer"));
    const [showAdvanced, setShowAdvanced] = React.useState(false);

    const handleRoleSelect = (roleId: string) => {
        setSelectedRole(roleId);
        setCustomPermissions(getDefaultPermissions(roleId as any));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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
            setShowAdvanced(false);
            onSuccess();
        }
    };

    const currentRoleConfig = roleConfig[selectedRole as keyof typeof roleConfig] || roleConfig.viewer;

    return (
        <div className="relative rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full -translate-y-32 translate-x-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary/10 to-transparent rounded-full translate-y-24 -translate-x-24" />

            <div className="relative p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                        <UserPlus className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Adicionar Novo Membro</h2>
                        <p className="text-muted-foreground">Convide alguém para colaborar na sua equipe</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-5">
                        <FormGroup>
                            <FormItem label="Nome Completo" htmlFor="member-name" required>
                                <Input
                                    id="member-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ex: Maria Silva"
                                    icon={<User className="w-4 h-4" />}
                                    required
                                    minLength={2}
                                />
                            </FormItem>

                            <FormItem label="Email" htmlFor="member-email" required>
                                <Input
                                    id="member-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="maria@empresa.com"
                                    icon={<Mail className="w-4 h-4" />}
                                    required
                                />
                            </FormItem>
                        </FormGroup>

                        <FormItem
                            label="Senha Inicial"
                            htmlFor="member-password"
                            required
                            hint="O membro poderá alterá-la depois"
                        >
                            <Input
                                id="member-password"
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Defina uma senha provisória"
                                icon={<Lock className="w-4 h-4" />}
                                required
                                minLength={6}
                                className="bg-primary/5 border-primary/20 focus:bg-background"
                            />
                        </FormItem>
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-4">
                        <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <Shield className="w-4 h-4 text-primary" />
                            Nível de Acesso
                        </label>

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
                      relative p-5 rounded-xl border-2 text-left transition-all duration-300 group
                      ${isSelected
                                                ? `${config.borderColor} ${config.lightBg} shadow-lg`
                                                : "border-border/50 bg-card hover:border-border hover:shadow-md"
                                            }
                    `}
                                    >
                                        {/* Selected indicator */}
                                        {isSelected && (
                                            <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center shadow-md`}>
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        )}

                                        <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all
                      ${isSelected
                                                ? `bg-gradient-to-br ${config.color} text-white shadow-lg`
                                                : `${config.lightBg} ${config.textColor} group-hover:scale-110`
                                            }
                    `}>
                                            <RoleIcon className="w-6 h-6" />
                                        </div>

                                        <p className={`font-bold ${isSelected ? config.textColor : "text-foreground"}`}>
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

                    {/* Advanced Permissions */}
                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showAdvanced ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                            Personalizar permissões por página
                        </button>

                        {showAdvanced && (
                            <div className="rounded-xl border border-border/50 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                                <div className="bg-muted/30 px-4 py-3 border-b border-border/30">
                                    <p className="text-sm font-medium text-foreground">Permissões Detalhadas</p>
                                </div>
                                <div className="p-4 space-y-1 bg-card">
                                    {Object.entries(customPermissions).map(([page, perms]) => (
                                        <div
                                            key={page}
                                            className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                                        >
                                            <span className="text-sm font-medium capitalize text-foreground">
                                                {page.replace("/", "")}
                                            </span>
                                            <div className="flex gap-2">
                                                <PermissionToggle
                                                    enabled={perms.canView}
                                                    onChange={(v) => {
                                                        setCustomPermissions(prev => ({
                                                            ...prev,
                                                            [page]: {
                                                                ...prev[page],
                                                                canView: v,
                                                                canCreate: v ? prev[page].canCreate : false,
                                                                canEdit: v ? prev[page].canEdit : false,
                                                                canDelete: v ? prev[page].canDelete : false,
                                                            }
                                                        }));
                                                    }}
                                                    label="Ver"
                                                    icon={Eye}
                                                />
                                                <PermissionToggle
                                                    enabled={perms.canCreate || false}
                                                    onChange={(v) => setCustomPermissions(prev => ({
                                                        ...prev,
                                                        [page]: { ...prev[page], canCreate: v }
                                                    }))}
                                                    label="Criar"
                                                    icon={UserPlus}
                                                    disabled={!perms.canView}
                                                />
                                                <PermissionToggle
                                                    enabled={perms.canEdit || false}
                                                    onChange={(v) => setCustomPermissions(prev => ({
                                                        ...prev,
                                                        [page]: { ...prev[page], canEdit: v }
                                                    }))}
                                                    label="Editar"
                                                    icon={Edit3}
                                                    disabled={!perms.canView}
                                                />
                                                <PermissionToggle
                                                    enabled={perms.canDelete || false}
                                                    onChange={(v) => setCustomPermissions(prev => ({
                                                        ...prev,
                                                        [page]: { ...prev[page], canDelete: v }
                                                    }))}
                                                    label="Excluir"
                                                    icon={Trash2}
                                                    disabled={!perms.canView}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-in shake duration-200">
                            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading || !name || !email || !password}
                        className={`
              w-full h-14 rounded-xl font-bold text-base transition-all duration-300
              bg-gradient-to-r from-primary to-primary/90 text-primary-foreground
              shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30
              hover:scale-[1.02] active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-md
              flex items-center justify-center gap-3
            `}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Criando membro...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                Adicionar à Equipe
                            </>
                        )}
                    </button>

                    <p className="text-xs text-center text-muted-foreground">
                        O novo membro poderá fazer login com o email e senha definidos.
                    </p>
                </form>
            </div>
        </div>
    );
}
