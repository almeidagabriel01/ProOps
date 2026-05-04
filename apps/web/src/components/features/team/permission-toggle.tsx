"use client";

import { Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface PermissionToggleProps {
    enabled: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    loading?: boolean;
    label: string;
    icon: React.ElementType;
}

export function PermissionToggle({
    enabled,
    onChange,
    disabled,
    loading,
    label,
    icon: Icon,
}: PermissionToggleProps) {
    return (
        <button
            type="button"
            onClick={() => !disabled && !loading && onChange(!enabled)}
            disabled={disabled || loading}
            className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-200
        ${(disabled || loading) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        ${enabled
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground border border-transparent hover:border-border"
                }
      `}
        >
            {loading ? (
                <Spinner className="w-3.5 h-3.5" />
            ) : (
                <Icon className="w-3.5 h-3.5" />
            )}
            {label}
            {enabled && !loading && <Check className="w-3 h-3" />}
        </button>
    );
}
