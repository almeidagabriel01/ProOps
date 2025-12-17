"use client";

import { Check } from "lucide-react";

interface PermissionToggleProps {
    enabled: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    label: string;
    icon: React.ElementType;
}

export function PermissionToggle({
    enabled,
    onChange,
    disabled,
    label,
    icon: Icon,
}: PermissionToggleProps) {
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
