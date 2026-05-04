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
import { useTenant } from "@/providers/tenant-provider";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useUpdatePermissions } from "@/hooks/useUpdatePermissions";
import { TeamSkeleton } from "./_components/team-skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { Users, Shield, UserPlus, X } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  TeamMember,
  Permission,
  CreateMemberSection,
  MemberCard,
} from "@/components/features/team";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { Loader } from "@/components/ui/loader";

export default function TeamPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { tenant, tenantOwner } = useTenant();
  const { isMaster, isLoading: permLoading } = usePermissions();

  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreatingMember, setIsCreatingMember] = React.useState(false);
  const [updatingKey, setUpdatingKey] = React.useState<string | null>(null);

  // Infinite scroll
  const {
    displayedItems: displayedMembers,
    hasMore,
    sentinelRef,
  } = useInfiniteScroll(members, 6);

  // Use Cloud Function hook for updating permissions
  const { updateSinglePermission, isLoading: savingPermissions } =
    useUpdatePermissions();

  const isFirstLoad = React.useRef(true);

  // Fetch team members
  const fetchMembers = React.useCallback(
    async (forceLoader?: boolean) => {
      if (!user?.id) return;
      if (user.role === "superadmin" && tenant?.id && !tenantOwner?.id) return;

      try {
        if (isFirstLoad.current || forceLoader) setIsLoading(true);

        let masterId = user.id;
        if (user.role === "superadmin" && tenant?.id && tenantOwner?.id) {
          masterId = tenantOwner.id;
        }

        const membersQuery = query(
          collection(db, "users"),
          where("masterId", "==", masterId),
        );

        const snapshot = await getDocs(membersQuery);
        const membersList: TeamMember[] = [];

        for (const memberDoc of snapshot.docs) {
          const data = memberDoc.data();

          const permissionsSnapshot = await getDocs(
            collection(db, "users", memberDoc.id, "permissions"),
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
      } catch (error: unknown) {
        console.error("Error fetching team members:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao carregar membros da equipe.";
        toast.error(message);
      } finally {
        setIsLoading(false);
        isFirstLoad.current = false;
      }
    },
    [tenant?.id, tenantOwner?.id, user?.id, user?.role],
  );

  React.useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Update permission using Cloud Function
  const updatePermission = async (
    memberId: string,
    pageId: string,
    key: string,
    value: boolean,
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

    const keyId = `${memberId}-${pageId}-${key}`;
    setUpdatingKey(keyId);

    try {
      // Call Cloud Function via hook
      const result = await updateSinglePermission(
        memberId,
        pageId,
        key as "canView" | "canEdit" | "canCreate" | "canDelete",
        value,
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
          }),
        );
      } else {
        // The hook already displays a toast; this is a fallback for unexpected responses
        toast.error("Não foi possível atualizar a permissão.");
      }
    } catch (error: unknown) {
      console.error("Unexpected error while updating permission:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao atualizar permissão.";
      toast.error(message);
    } finally {
      setUpdatingKey(null);
    }
  };

  // Loading
  if (permLoading || isLoading || authLoading) {
    return <TeamSkeleton />;
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
    <FormContainer>
      <FormHeader
        title="Equipe"
        subtitle="Gerencie os membros da sua equipe e suas permissões"
        icon={Users}
      />

      <div className="flex justify-end">
        <Button
          onClick={() => setIsCreatingMember(!isCreatingMember)}
          variant={isCreatingMember ? "outline" : "default"}
          className="shrink-0"
        >
          {isCreatingMember ? (
            <>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Membro
            </>
          )}
        </Button>
      </div>

      {/* Create Member Form (Collapsible) */}
      {isCreatingMember && (
        <div className="animate-in slide-in-from-top-4 fade-in duration-300 shrink-0">
          <CreateMemberSection
            onSuccess={() => {
              fetchMembers(true);
              setIsCreatingMember(false);
            }}
          />
        </div>
      )}

      {/* Content Wrapper */}
      <div className="flex flex-col gap-4 flex-1">
        {/* Members List */}
        <div className="space-y-4">
          {members.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                Membros ({members.length})
              </h2>

              <div className="grid gap-4">
                {displayedMembers.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onUpdatePermission={updatePermission}
                    saving={savingPermissions}
                    updatingKey={updatingKey}
                    onRefresh={() => fetchMembers(true)}
                  />
                ))}
              </div>
              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="flex items-center justify-center py-4"
                >
                  <Loader size="md" />
                </div>
              )}
            </div>
          ) : (
            !isLoading &&
            !isCreatingMember && (
              <Card className="p-12 text-center border-dashed">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Sua equipe está vazia
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Adicione membros para colaborar no gerenciamento da sua
                  empresa.
                </p>
                <Button onClick={() => setIsCreatingMember(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar Primeiro Membro
                </Button>
              </Card>
            )
          )}
        </div>
      </div>
    </FormContainer>
  );
}
