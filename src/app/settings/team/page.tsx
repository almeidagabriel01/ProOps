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
import { useUpdatePermissions } from "@/hooks/useUpdatePermissions";
import { Card } from "@/components/ui/card";
import { Users, Loader2, Shield } from "lucide-react";
import { toast } from "react-toastify";
import {
    TeamMember,
    Permission,
    CreateMemberSection,
    MemberCard,
} from "@/components/features/team";

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

    // Use Cloud Function hook for updating permissions
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

    // Update permission using Cloud Function
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
