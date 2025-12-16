"use client";

/**
 * MEMBER Profile Section
 * 
 * Shows company and MASTER information for MEMBER users.
 * This component should be used in the profile page.
 */

import { useUserRole } from "@/providers/permissions-provider";
import { Building, Crown, Users } from "lucide-react";

export function MemberProfileSection() {
    const {
        isMember,
        isMaster,
        companyName,
        masterName,
        isLoading
    } = useUserRole();

    // Don't show anything while loading
    if (isLoading) {
        return (
            <div className="bg-neutral-800/50 rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-neutral-700 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-neutral-700 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-neutral-700 rounded w-1/2"></div>
            </div>
        );
    }

    // MASTER view
    if (isMaster) {
        return (
            <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-violet-500/20 rounded-lg">
                        <Crown className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Administrador da Conta</h3>
                        <p className="text-sm text-neutral-400">Você é o proprietário desta conta</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 pl-2">
                    <Building className="w-4 h-4 text-neutral-500" />
                    <span className="text-neutral-300">{companyName}</span>
                </div>
            </div>
        );
    }

    // MEMBER view
    if (isMember) {
        return (
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Membro da Equipe</h3>
                        <p className="text-sm text-neutral-400">
                            Você faz parte da empresa <strong>{companyName}</strong>
                        </p>
                    </div>
                </div>

                <div className="space-y-2 pl-2">
                    <div className="flex items-center gap-3">
                        <Building className="w-4 h-4 text-neutral-500" />
                        <span className="text-neutral-300">{companyName}</span>
                    </div>

                    {masterName && (
                        <div className="flex items-center gap-3">
                            <Crown className="w-4 h-4 text-neutral-500" />
                            <span className="text-neutral-300">
                                Administrador: <strong>{masterName}</strong>
                            </span>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-blue-500/20">
                    <p className="text-sm text-blue-300/80">
                        Você utiliza o plano contratado pelo administrador da conta.
                        Para alterar seu plano ou configurações avançadas, entre em contato com o administrador.
                    </p>
                </div>
            </div>
        );
    }

    return null;
}

/**
 * Plan info hidden for MEMBER users
 */
export function PlanInfoForMaster({ children }: { children: React.ReactNode }) {
    const { isMember, isLoading } = useUserRole();

    if (isLoading) return null;
    if (isMember) return null;

    return <>{children}</>;
}
