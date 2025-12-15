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
