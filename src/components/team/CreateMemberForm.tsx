"use client";

/**
 * Example: Create Member Form
 * 
 * This component demonstrates how to use the useCreateMember hook
 * to create new team members (MEMBER users) linked to the current MASTER.
 * 
 * Only users with role = MASTER can see and use this form.
 */

import { useState } from "react";
import { useCreateMember, getDefaultPermissions } from "@/hooks/useCreateMember";

// Simple permission toggle component
function PermissionRow({
    page,
    permissions,
    onChange,
}: {
    page: string;
    permissions: { canView: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean };
    onChange: (page: string, key: string, value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-700 capitalize">
                {page.replace("/", "")}
            </span>
            <div className="flex gap-4">
                <label className="flex items-center gap-1 text-sm">
                    <input
                        type="checkbox"
                        checked={permissions.canView}
                        onChange={(e) => onChange(page, "canView", e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    Visualizar
                </label>
                <label className="flex items-center gap-1 text-sm">
                    <input
                        type="checkbox"
                        checked={permissions.canCreate ?? false}
                        onChange={(e) => onChange(page, "canCreate", e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    Criar
                </label>
                <label className="flex items-center gap-1 text-sm">
                    <input
                        type="checkbox"
                        checked={permissions.canEdit ?? false}
                        onChange={(e) => onChange(page, "canEdit", e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    Editar
                </label>
                <label className="flex items-center gap-1 text-sm">
                    <input
                        type="checkbox"
                        checked={permissions.canDelete ?? false}
                        onChange={(e) => onChange(page, "canDelete", e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    Excluir
                </label>
            </div>
        </div>
    );
}

export function CreateMemberForm() {
    const { createMember, isLoading, error } = useCreateMember();

    // Form state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [roleType, setRoleType] = useState<"viewer" | "editor" | "admin">("viewer");
    const [permissions, setPermissions] = useState(getDefaultPermissions("viewer"));

    // Update permissions when role type changes
    const handleRoleChange = (role: "viewer" | "editor" | "admin") => {
        setRoleType(role);
        setPermissions(getDefaultPermissions(role));
    };

    // Update individual permission
    const handlePermissionChange = (page: string, key: string, value: boolean) => {
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
            permissions,
        });

        if (result?.success) {
            // Reset form on success
            setName("");
            setEmail("");
            setRoleType("viewer");
            setPermissions(getDefaultPermissions("viewer"));
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Adicionar Membro da Equipe
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Completo
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: João Silva"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        minLength={2}
                    />
                </div>

                {/* Email Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="joao@empresa.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                </div>

                {/* Role Type Selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Acesso
                    </label>
                    <div className="flex gap-3">
                        {(["viewer", "editor", "admin"] as const).map((role) => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => handleRoleChange(role)}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${roleType === role
                                        ? "bg-blue-500 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                            >
                                {role === "viewer" && "👁️ Visualizador"}
                                {role === "editor" && "✏️ Editor"}
                                {role === "admin" && "🛡️ Administrador"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Permissions */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Permissões por Página
                    </label>
                    <div className="space-y-2">
                        {Object.entries(permissions).map(([page, perms]) => (
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
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${isLoading
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-blue-500 hover:bg-blue-600"
                        }`}
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                            </svg>
                            Criando...
                        </span>
                    ) : (
                        "Adicionar Membro"
                    )}
                </button>
            </form>

            {/* Usage Note */}
            <p className="mt-4 text-sm text-gray-500 text-center">
                O novo membro receberá um email para definir sua senha.
            </p>
        </div>
    );
}

// ============================================
// EXAMPLE USAGE IN A PAGE
// ============================================

/*
// src/app/settings/team/page.tsx

import { CreateMemberForm } from "@/components/team/CreateMemberForm";

export default function TeamSettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Gerenciar Equipe</h1>
      <CreateMemberForm />
    </div>
  );
}
*/
