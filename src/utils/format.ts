import { formatDateBR } from "@/utils/date-format";

/**
 * Format price to Brazilian currency
 */
export function formatPrice(price: number): string {
    if (price === 0) return "Grátis";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(price);
}

/**
 * Format currency value (always shows value, never "Grátis")
 */
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

export function formatCurrency(value: number): string {
    return currencyFormatter.format(value);
}

/**
 * Format date to Brazilian short format (e.g., "15 dez")
 */
export function formatDateShort(dateString: string): string {
    return formatDateBR(dateString, "");
}

/**
 * Format date to Brazilian full format (e.g., "15/12/2024")
 */
export function formatDateFull(dateString: string): string {
    return formatDateBR(dateString, "");
}

/**
 * Get greeting based on current hour
 */
export function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

/**
 * Format limit value (-1 means unlimited)
 */
export function formatLimit(value: number): string {
    return value === -1 ? "Ilimitado" : value.toString();
}

/**
 * Get role display label
 */
export function getRoleLabel(role: string): string {
    switch (role) {
        case "superadmin":
            return "Super Admin";
        case "admin":
            return "Administrador";
        case "user":
            return "Usuário";
        case "free":
            return "Gratuito";
        default:
            return role;
    }
}

/**
 * Get role badge variant
 */
export function getRoleBadgeVariant(role: string): "default" | "outline" | "destructive" | "secondary" {
    switch (role) {
        case "superadmin":
            return "destructive";
        case "admin":
            return "default";
        case "free":
            return "secondary";
        default:
            return "outline";
    }
}
