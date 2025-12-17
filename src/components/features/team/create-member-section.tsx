"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    UserPlus,
    Loader2,
    Eye,
    Edit3,
    Trash2,
    ChevronDown,
    ChevronUp,
    Sparkles,
    AlertCircle
} from "lucide-react";
import { useCreateMember, getDefaultPermissions } from "@/hooks/useCreateMember";
import { Permission, ROLE_PRESETS } from "./team-types";
import { PermissionToggle } from "./permission-toggle";

interface CreateMemberSectionProps {
    onSuccess: () => void;
}

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

    return (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <UserPlus className="w-5 h-5 text-primary" />
                    Adicionar novo membro
                </CardTitle>
                <CardDescription>
                    Convide alguém para sua equipe
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Nome</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Maria Silva"
                                required
                                minLength={2}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="maria@empresa.com"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">Senha Inicial</label>
                        <Input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Defina uma senha provisória"
                            required
                            minLength={6}
                            className="bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            * Defina uma senha e envie ao membro. Ele poderá alterá-la depois.
                        </p>
                    </div>

                    {/* Role Selection */}
                    <div>
                        <label className="text-sm font-medium mb-3 block">
                            Nível de acesso
                        </label>
                        <div className="grid md:grid-cols-3 gap-3">
                            {ROLE_PRESETS.map((role) => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => handleRoleSelect(role.id)}
                                    className={`
                    p-4 rounded-xl border-2 text-left transition-all duration-200
                    ${selectedRole === role.id
                                            ? `${role.color} border-current`
                                            : "border-border hover:border-primary/50 bg-card"
                                        }
                  `}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xl">{role.icon}</span>
                                        <span className="font-semibold">{role.name}</span>
                                    </div>
                                    <p className="text-xs opacity-80">{role.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Advanced: Custom Permissions */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Sparkles className="w-4 h-4" />
                            Personalizar permissões
                            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {showAdvanced && (
                            <div className="mt-4 space-y-2 p-4 bg-muted/50 rounded-xl">
                                {Object.entries(customPermissions).map(([page, perms]) => (
                                    <div
                                        key={page}
                                        className="flex items-center justify-between py-2"
                                    >
                                        <span className="text-sm capitalize">
                                            {page.replace("/", "")}
                                        </span>
                                        <div className="flex gap-2 flex-wrap justify-end">
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
                                                onChange={(v) => {
                                                    setCustomPermissions(prev => ({
                                                        ...prev,
                                                        [page]: { ...prev[page], canCreate: v }
                                                    }));
                                                }}
                                                label="Criar"
                                                icon={UserPlus}
                                                disabled={!perms.canView}
                                            />
                                            <PermissionToggle
                                                enabled={perms.canEdit || false}
                                                onChange={(v) => {
                                                    setCustomPermissions(prev => ({
                                                        ...prev,
                                                        [page]: { ...prev[page], canEdit: v }
                                                    }));
                                                }}
                                                label="Editar"
                                                icon={Edit3}
                                                disabled={!perms.canView}
                                            />
                                            <PermissionToggle
                                                enabled={perms.canDelete || false}
                                                onChange={(v) => {
                                                    setCustomPermissions(prev => ({
                                                        ...prev,
                                                        [page]: { ...prev[page], canDelete: v }
                                                    }));
                                                }}
                                                label="Excluir"
                                                icon={Trash2}
                                                disabled={!perms.canView}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <Button
                        type="submit"
                        disabled={isLoading || !name || !email || !password}
                        className="w-full"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Criando...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Adicionar à equipe
                            </>
                        )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                        O novo membro receberá um email para definir sua senha.
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}
