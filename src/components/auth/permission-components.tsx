"use client";

/**
 * Permission-Aware UI Components
 * 
 * Components that automatically show/hide based on user permissions.
 * These are for UI convenience only - backend is the source of truth.
 */

import * as React from "react";
import { usePermissions, usePagePermission, useUserRole } from "@/providers/permissions-provider";

// ============================================
// PERMISSION GATE COMPONENTS
// ============================================

interface PermissionGateProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Only renders children if user has the specified permission on a page.
 */
interface PagePermissionGateProps extends PermissionGateProps {
    pageId: string;
    action: 'view' | 'create' | 'edit' | 'delete';
}

export function PagePermissionGate({
    pageId,
    action,
    children,
    fallback = null,
}: PagePermissionGateProps) {
    const { hasPermission, isLoading } = usePermissions();

    if (isLoading) return null;

    if (!hasPermission(pageId, action)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * Only renders children if user is MASTER.
 */
export function MasterOnly({ children, fallback = null }: PermissionGateProps) {
    const { isMaster, isLoading } = usePermissions();

    if (isLoading) return null;
    if (!isMaster) return <>{fallback}</>;

    return <>{children}</>;
}

/**
 * Only renders children if user is MEMBER.
 */
export function MemberOnly({ children, fallback = null }: PermissionGateProps) {
    const { isMember, isLoading } = usePermissions();

    if (isLoading) return null;
    if (!isMember) return <>{fallback}</>;

    return <>{children}</>;
}

// ============================================
// PERMISSION-AWARE BUTTONS
// ============================================

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    pageId: string;
    action: 'create' | 'edit' | 'delete';
    disabledMessage?: string;
}

/**
 * Button that's automatically disabled if user lacks permission.
 * Shows a tooltip explaining why it's disabled.
 */
export function PermissionButton({
    pageId,
    action,
    children,
    disabled,
    disabledMessage,
    className = "",
    ...props
}: PermissionButtonProps) {
    const { hasPermission, isLoading } = usePermissions();

    const hasAccess = hasPermission(pageId, action);
    const isDisabled = disabled || !hasAccess || isLoading;

    const getMessage = () => {
        if (disabled) return undefined;
        if (isLoading) return "Carregando...";
        if (!hasAccess) {
            return disabledMessage || `Você não tem permissão para ${action === 'create' ? 'criar' :
                    action === 'edit' ? 'editar' :
                        'excluir'
                }`;
        }
        return undefined;
    };

    return (
        <button
            {...props}
            disabled={isDisabled}
            className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={getMessage()}
        >
            {children}
        </button>
    );
}

// ============================================
// NAVIGATION HELPERS
// ============================================

interface NavItemProps {
    pageId: string;
    href: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

/**
 * Navigation item that only shows if user can view the page.
 */
export function PermissionNavItem({
    pageId,
    href,
    icon,
    children,
    className = "",
}: NavItemProps) {
    const { canView } = usePagePermission(pageId);
    const { isMember } = useUserRole();

    // Check if this is a MASTER-only page
    const masterOnlyPages = ['team', 'billing'];
    if (isMember && masterOnlyPages.includes(pageId)) {
        return null;
    }

    if (!canView) return null;

    return (
        <a href={href} className={className}>
            {icon}
            {children}
        </a>
    );
}

// ============================================
// MEMBER INFO COMPONENT
// ============================================

/**
 * Shows information about the MASTER for MEMBER users.
 * Used in profile pages.
 */
export function MemberCompanyInfo() {
    const { isMember, companyName, masterName, isLoading } = useUserRole();

    if (isLoading) {
        return (
            <div className="animate-pulse bg-gray-100 rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
        );
    }

    if (!isMember) return null;

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <svg
                        className="w-5 h-5 text-blue-500 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                    </svg>
                </div>
                <div>
                    <h4 className="font-medium text-blue-900">
                        {companyName}
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                        Você faz parte da empresa <strong>{companyName}</strong> e utiliza
                        o plano contratado pelo administrador
                        {masterName && <strong> {masterName}</strong>}.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ============================================
// PLAN VISIBILITY COMPONENTS
// ============================================

/**
 * Hides plan-related UI from MEMBER users.
 * MEMBERs should never see upgrade buttons or plan info.
 */
export function HideForMember({ children }: { children: React.ReactNode }) {
    const { isMember, isLoading } = usePermissions();

    if (isLoading) return null;
    if (isMember) return null;

    return <>{children}</>;
}

/**
 * Upgrade button that's hidden from MEMBERs.
 */
export function UpgradeButton({
    children,
    className = "",
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const { isMember, isLoading } = usePermissions();

    if (isLoading || isMember) return null;

    return (
        <button className={className} {...props}>
            {children}
        </button>
    );
}
