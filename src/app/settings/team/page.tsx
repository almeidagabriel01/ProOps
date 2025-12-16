"use client";

/**
 * Team Management Page - Modern UX
 * 
 * MASTER-only page for:
 * - Viewing team members
 * - Creating new members with role presets
 * - Managing member permissions with toggles
 */

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useCreateMember, getDefaultPermissions } from "@/hooks/useCreateMember";
import { useUpdatePermissions } from "@/hooks/useUpdatePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Users,
    UserPlus,
    Loader2,
    Mail,
    Shield,
    Eye,
    EyeOff,
    Edit3,
    Trash2,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Sparkles,
    AlertCircle
} from "lucide-react";
import { toast } from "react-toastify";
import { useMemberActions } from "@/hooks/useMemberActions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

// ============================================
// TYPES
// ============================================

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    permissions: Record<string, Permission>;
}

interface Permission {
    canView: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const AVAILABLE_PAGES = [
    { id: "dashboard", name: "Dashboard", description: "Visão geral e métricas" },
    { id: "proposals", name: "Propostas", description: "Criar e gerenciar propostas" },
    { id: "clients", name: "Clientes", description: "Base de clientes" },
    { id: "products", name: "Produtos", description: "Catálogo de produtos" },
    { id: "financial", name: "Financeiro", description: "Fluxo de caixa e transações" },
];

const ROLE_PRESETS = [
    {
        id: "viewer",
        name: "Visualizador",
        icon: "👁️",
        description: "Pode apenas visualizar dados",
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
    {
        id: "editor",
        name: "Editor",
        icon: "✏️",
        description: "Pode visualizar e editar dados",
        color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    {
        id: "admin",
        name: "Administrador",
        icon: "🛡️",
        description: "Acesso completo (exceto plano)",
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    },
];

// ============================================
// PERMISSION TOGGLE COMPONENT
// ============================================

function PermissionToggle({
    enabled,
    onChange,
    disabled,
    label,
    icon: Icon,
}: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    label: string;
    icon: React.ElementType;
}) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!enabled)}
            disabled={disabled}
            className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-200
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${enabled
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground border border-transparent hover:border-border"
                }
      `}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {enabled && <Check className="w-3 h-3" />}
        </button>
    );
}

// ============================================
// PAGE ROW COMPONENT
// ============================================

function PagePermissionRow({
    page,
    permission,
    onUpdate,
    saving,
}: {
    page: typeof AVAILABLE_PAGES[0];
    permission: Permission;
    onUpdate: (key: string, value: boolean) => void;
    saving: boolean;
}) {
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
                {/* Status indicator */}
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

// ============================================
// CREATE MEMBER MODAL
// ============================================

function CreateMemberSection({
    onSuccess,
}: {
    onSuccess: () => void;
}) {
    const { createMember, isLoading, error } = useCreateMember();
    const [step, setStep] = React.useState(1);
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
            // Reset
            setName("");
            setEmail("");
            setPassword("");
            setSelectedRole("viewer");
            setCustomPermissions(getDefaultPermissions("viewer"));
            setStep(1);
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
                    {/* Step 1: Basic Info */}
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

                    {/* Step 2: Role Selection */}
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
                                                            // If turning off view, turn off everything
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

// ============================================
// MODALS
// ============================================

function EditMemberModal({
    member,
    open,
    onOpenChange,
    onSuccess,
}: {
    member: TeamMember;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}) {
    const { updateMember, isLoading } = useMemberActions();
    const [name, setName] = React.useState(member.name);
    const [email, setEmail] = React.useState(member.email);
    const [password, setPassword] = React.useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await updateMember({
            memberId: member.id,
            name,
            email,
            password: password || undefined,
        });
        if (success) {
            onSuccess();
            onOpenChange(false);
            setPassword("");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Membro</DialogTitle>
                    <DialogDescription>
                        Atualize as informações de {member.name}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Nome</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                        <Label>Email</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                        <Label>Nova Senha (Opcional)</Label>
                        <Input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Deixe em branco para manter a atual"
                            minLength={6}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteMemberDialog({
    member,
    open,
    onOpenChange,
    onSuccess,
}: {
    member: TeamMember;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}) {
    const { deleteMember, isLoading } = useMemberActions();

    const handleDelete = async () => {
        const success = await deleteMember(member.id);
        if (success) {
            onSuccess();
            onOpenChange(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remover Membro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Você tem certeza que deseja remover <b>{member.name}</b>?
                        Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={isLoading}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                    >
                        {isLoading ? "Removendo..." : "Sim, Remover"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ============================================
// MEMBER CARD COMPONENT
// ============================================

function MemberCard({
    member,
    onUpdatePermission,
    saving,
    onRefresh,
}: {
    member: TeamMember;
    onUpdatePermission: (memberId: string, pageId: string, key: string, value: boolean) => void;
    saving: boolean;
    onRefresh: () => void;
}) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [showEdit, setShowEdit] = React.useState(false);
    const [showDelete, setShowDelete] = React.useState(false);
    // Needs to trigger parent refresh
    const router = React.useMemo(() => ({ refresh: () => window.location.reload() }), []); // Hack/Refresh logic passed from parent? 
    // Actually parent passes onSuccess. We might need onSuccess call in MemberCard or simpler: pass a callback.
    // Ideally TeamPage should handle refresh. Let's assume we pass a refresh callback to MemberCard?
    // Wait, MemberCard props are defined. I should add `onRefresh` prop.
    // For now I'll just use window.location.reload() inside modals? No, better pass `onRefresh`.

    return (
        <>
            <Card className="overflow-hidden">
                {/* Header */}
                <div className="flex items-center p-2 pr-4 hover:bg-muted/10 transition-colors">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex-1 p-2 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                <span className="font-bold text-primary text-lg">
                                    {member.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="text-left">
                                <p className="font-semibold">{member.name}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {member.email}
                                </p>
                            </div>
                        </div>
                    </button>

                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="gap-1">
                            <Users className="w-3 h-3" />
                            Membro
                        </Badge>

                        {/* Actions */}
                        <div className="flex items-center gap-1 border-l pl-3 ml-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-blue-600" onClick={() => setShowEdit(true)}>
                                <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-red-600" onClick={() => setShowDelete(true)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>

                        <button onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Permissions Panel */}
                {isExpanded && (
                    <div className="border-t bg-muted/20 p-4">
                        <h4 className="font-medium mb-4 flex items-center gap-2 text-sm">
                            <Shield className="w-4 h-4" />
                            Permissões por página
                        </h4>

                        <div className="space-y-2">
                            {AVAILABLE_PAGES.map((page) => (
                                <PagePermissionRow
                                    key={page.id}
                                    page={page}
                                    permission={member.permissions[page.id] || { canView: false }}
                                    onUpdate={(key, value) => onUpdatePermission(member.id, page.id, key, value)}
                                    saving={saving}
                                />
                            ))}
                        </div>

                        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Alterações são salvas automaticamente
                        </p>
                    </div>
                )}
            </Card>

            <EditMemberModal
                member={member}
                open={showEdit}
                onOpenChange={setShowEdit}
                onSuccess={onRefresh}
            />
            <DeleteMemberDialog
                member={member}
                open={showDelete}
                onOpenChange={setShowDelete}
                onSuccess={onRefresh}
            />
        </>
    );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function TeamPage() {
    const { user } = useAuth();
    const { isMaster, isLoading: permLoading } = usePermissions();

    React.useEffect(() => {
        if (user) {
            console.log("DEBUG: Current User Data:", {
                uid: user.id,
                role: user.role,
                planId: user.planId,
                email: user.email
            });
        }
    }, [user]);

    const [members, setMembers] = React.useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    // Use Cloud Function hook for updating permissions (NOT direct Firestore writes)
    const { updateSinglePermission, isLoading: savingPermissions } = useUpdatePermissions();

    // Fetch team members
    const fetchMembers = React.useCallback(async () => {
        if (!user?.id) return;

        try {
            if (members.length === 0) setIsLoading(true);

            const membersQuery = query(
                collection(db, "users"),
                where("masterId", "==", user.id)
            );

            const snapshot = await getDocs(membersQuery);
            const membersList: TeamMember[] = [];

            for (const memberDoc of snapshot.docs) {
                const data = memberDoc.data();

                const permissionsSnapshot = await getDocs(
                    collection(db, "users", memberDoc.id, "permissions")
                );

                const permissions: Record<string, Permission> = {};
                permissionsSnapshot.forEach((permDoc) => {
                    permissions[permDoc.id] = permDoc.data() as Permission;
                });

                membersList.push({
                    id: memberDoc.id,
                    name: data.name || "Sem nome",
                    email: data.email || "",
                    role: data.role || "MEMBER",
                    createdAt: data.createdAt || new Date().toISOString(),
                    permissions,
                });
            }

            setMembers(membersList);
        } catch (error) {
            console.error("Error fetching members:", error);
            toast.error("Erro ao carregar membros");
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    React.useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    // Update permission using Cloud Function (NOT direct Firestore writes)
    const updatePermission = async (
        memberId: string,
        pageId: string,
        key: string,
        value: boolean
    ) => {
        const member = members.find((m) => m.id === memberId);
        if (!member) return;

        const currentPerms = member.permissions[pageId] || { canView: false };
        const newPerms = { ...currentPerms, [key]: value };

        // If turning off canView, turn off everything else
        if (key === "canView" && !value) {
            newPerms.canCreate = false;
            newPerms.canEdit = false;
            newPerms.canDelete = false;
        }

        // Call Cloud Function via hook
        const result = await updateSinglePermission(
            memberId,
            pageId,
            key as "canView" | "canEdit" | "canCreate" | "canDelete",
            value,
            member.permissions
        );

        // Update local state only on success
        if (result?.success) {
            setMembers((prev) =>
                prev.map((m) => {
                    if (m.id === memberId) {
                        return {
                            ...m,
                            permissions: {
                                ...m.permissions,
                                [pageId]: newPerms,
                            },
                        };
                    }
                    return m;
                })
            );
        }
    };

    // Loading
    if (permLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Access denied
    if (!isMaster) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Shield className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
                <p className="text-muted-foreground">
                    Apenas o administrador pode gerenciar a equipe.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Users className="w-8 h-8" />
                    Equipe
                </h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie os membros da sua equipe e suas permissões
                </p>
            </div>

            {/* Create Member */}
            <CreateMemberSection onSuccess={fetchMembers} />

            {/* Members List */}
            {members.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        Membros ({members.length})
                    </h2>

                    {members.map((member) => (
                        <MemberCard
                            key={member.id}
                            member={member}
                            onUpdatePermission={updatePermission}
                            saving={savingPermissions}
                            onRefresh={fetchMembers}
                        />
                    ))}
                </div>
            )}

            {members.length === 0 && !isLoading && (
                <Card className="p-8 text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                        Você ainda não adicionou nenhum membro.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Use o formulário acima para convidar alguém.
                    </p>
                </Card>
            )}
        </div>
    );
}
