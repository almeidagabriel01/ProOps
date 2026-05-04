"use client";

interface CompanyAvatarProps {
    name: string;
    logoUrl?: string;
}

export function CompanyAvatar({ name, logoUrl }: CompanyAvatarProps) {
    if (logoUrl) {
        return (
            <div className="h-10 w-10 rounded-lg border bg-muted/50 p-1 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={logoUrl}
                    alt={name}
                    className="h-full w-full object-contain"
                />
            </div>
        );
    }

    return (
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">
                {name.charAt(0).toUpperCase()}
            </span>
        </div>
    );
}
