"use client";

import { Badge } from "@/components/ui/badge";
import {
    Mail,
    Shield,
    Crown,
} from "lucide-react";
import { User, Tenant, UserPlan } from "@/types";
import { getRoleLabel, getRoleBadgeVariant } from "@/utils/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateBR } from "@/utils/date-format";

interface ProfileHeaderProps {
    user: User | null;
    tenant: Tenant | null;
    userPlan?: UserPlan | null;
}

export function ProfileHeader({ user, tenant, userPlan }: ProfileHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row gap-6 items-center p-6 bg-gradient-to-r from-background to-muted/20 border rounded-xl shadow-sm">
            {/* Avatar Section */}
            <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                    {tenant?.logoUrl && (
                        <AvatarImage src={tenant.logoUrl} alt={tenant.name} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                        {user?.name?.substring(0, 2).toUpperCase() || "US"}
                    </AvatarFallback>
                </Avatar>
                {/* Status Indicator (Online/Active) - Decorative */}
                <span className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 border-2 border-background rounded-full"></span>
            </div>

            {/* Info Section */}
            <div className="flex-1 text-center md:text-left space-y-2">
                <div className="flex flex-col md:flex-row md:items-center gap-2 justify-center md:justify-start">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {user?.name || "Usuário"}
                    </h1>
                    {userPlan && (
                        <Badge variant="outline" className="w-fit mx-auto md:mx-0 border-indigo-500/30 bg-indigo-500/10 text-indigo-500 gap-1 rounded-full px-3">
                            <Crown className="w-3 h-3 fill-indigo-500/20" />
                            {userPlan.name}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground text-sm">
                    <Mail className="w-4 h-4" />
                    <span>{user?.email || "email@exemplo.com"}</span>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                    {/* Role Badge */}
                    <Badge
                        variant={getRoleBadgeVariant(user?.role || "user")}
                        className="gap-1.5"
                    >
                        <Shield className="w-3 h-3" />
                        {getRoleLabel(user?.role || "user")}
                    </Badge>

                    {tenant && (
                        <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
                            {tenant.name} • <span className="capitalize">{tenant.niche?.replace(/_/g, " ")}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="hidden md:block border-l pl-6 py-2">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Membro desde</p>
                    <p className="text-sm font-semibold">
                        {formatDateBR(tenant?.createdAt ?? new Date())}
                    </p>
                </div>
            </div>
        </div>
    );
}
