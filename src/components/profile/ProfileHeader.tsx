"use client";

import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    User as UserIcon,
    Mail,
    Building2,
    Shield,
    Crown,
} from "lucide-react";
import { User, Tenant, UserPlan } from "@/types";
import { getRoleLabel, getRoleBadgeVariant } from "@/utils/format";

interface ProfileHeaderProps {
    user: User | null;
    tenant: Tenant | null;
    userPlan?: UserPlan | null;
}

export function ProfileHeader({ user, tenant, userPlan }: ProfileHeaderProps) {
    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                    {/* Avatar - Show tenant logo if available */}
                    {tenant?.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={tenant.logoUrl}
                            alt={tenant.name}
                            className="h-20 w-20 object-contain shrink-0"
                        />
                    ) : (
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center shrink-0">
                            <UserIcon className="w-10 h-10 text-primary" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-2xl">
                                    {user?.name || "Usuário"}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-1">
                                    <Mail className="w-4 h-4" />
                                    {user?.email || "email@exemplo.com"}
                                </CardDescription>
                            </div>
                            {tenant && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                                    <Building2 className="w-4 h-4" />
                                    <span className="font-medium text-foreground">{tenant.name}</span>
                                    <span>•</span>
                                    <span className="capitalize">{tenant.niche?.replace(/_/g, " ")}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 mt-3">
                            {/* Plan badge - only show if not free */}
                            {userPlan && (
                                <Badge variant="success">
                                    <Crown className="w-3 h-3 mr-1" />
                                    {userPlan.name}
                                </Badge>
                            )}
                            {/* Role badge - only show for non-standard roles */}
                            {(user?.role === "superadmin" || user?.role === "free") && (
                                <Badge
                                    variant={getRoleBadgeVariant(user?.role || "user")}
                                >
                                    <Shield className="w-3 h-3 mr-1" />
                                    {getRoleLabel(user?.role || "user")}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>
    );
}

