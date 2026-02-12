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
 * Parse a date string safely, avoiding timezone issues
 * When using new Date("2026-01-05"), JS interprets it as UTC midnight,
 * which becomes the previous day in timezones like Brazil (UTC-3)
 */
function parseLocalDate(dateString: string): Date {
    // Check specifically for YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split("-").map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
    }
    // Fallback for ISO strings (e.g., 2026-02-12T14:37:58.000Z) and other formats
    return new Date(dateString);
}

/**
 * Format date to Brazilian short format (e.g., "15 dez")
 */
export function formatDateShort(dateString: string): string {
    return parseLocalDate(dateString).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
    });
}

/**
 * Format date to Brazilian full format (e.g., "15/12/2024")
 */
export function formatDateFull(dateString: string): string {
    return parseLocalDate(dateString).toLocaleDateString("pt-BR");
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
