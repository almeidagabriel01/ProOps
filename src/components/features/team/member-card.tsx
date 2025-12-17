"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Mail,
    Shield,
    Edit3,
    Trash2,
    ChevronDown,
    ChevronUp,
    Check,
} from "lucide-react";
import { TeamMember, AVAILABLE_PAGES } from "./team-types";
import { PagePermissionRow } from "./page-permission-row";
import { EditMemberModal, DeleteMemberDialog } from "./member-modals";

interface MemberCardProps {
    member: TeamMember;
    onUpdatePermission: (memberId: string, pageId: string, key: string, value: boolean) => void;
    saving: boolean;
    onRefresh: () => void;
}

export function MemberCard({
    member,
    onUpdatePermission,
    saving,
    onRefresh,
}: MemberCardProps) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [showEdit, setShowEdit] = React.useState(false);
    const [showDelete, setShowDelete] = React.useState(false);

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
