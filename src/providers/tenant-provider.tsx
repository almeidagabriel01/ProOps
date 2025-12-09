"use client"

import * as React from "react"
import { MockDB, Tenant } from "@/lib/mock-db"

interface TenantContextType {
    tenant: Tenant | null
    isLoading: boolean
    loginAsTimestamp: number // Force re-render trick
    refreshTenant: () => void
    logout: () => void
}

const TenantContext = React.createContext<TenantContextType>({
    tenant: null,
    isLoading: true,
    loginAsTimestamp: 0,
    refreshTenant: () => { },
    logout: () => { }
})

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const [tenant, setTenant] = React.useState<Tenant | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [loginAsTimestamp, setLoginAsTimestamp] = React.useState(0)

    // Function to load/reload tenant from storage
    const loadTenant = React.useCallback(() => {
        setIsLoading(true)
        const currentId = MockDB.getCurrentTenantId()
        if (currentId) {
            const found = MockDB.getTenantById(currentId)
            setTenant(found || null)
        } else {
            setTenant(null)
        }
        setIsLoading(false)
    }, [])

    // Initial load
    React.useEffect(() => {
        loadTenant()
    }, [loadTenant])

    // Watch for external login triggers (Super Admin switching updates storage directly)
    React.useEffect(() => {
        const handleStorageChange = () => loadTenant()
        window.addEventListener('storage', handleStorageChange) // Cross-tab support
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [loadTenant])

    const refreshTenant = () => {
        loadTenant()
        setLoginAsTimestamp(Date.now())
    }

    const logout = () => {
        MockDB.logout()
        setTenant(null)
        window.location.href = '/admin' // Redirect to "Super Admin" login
    }

    // --- Dynamic Branding Injection ---
    React.useEffect(() => {
        if (!tenant) {
            // Reset to default dark theme
            document.documentElement.style.removeProperty('--primary')
            document.documentElement.style.removeProperty('--primary-foreground')
            return
        }

        // Apply Tenant Brand Color
        // We assume the color is a bright hex, so foreground is black. 
        // In a real app we would calculate contrast.
        document.documentElement.style.setProperty('--primary', tenant.primaryColor)
        document.documentElement.style.setProperty('--primary-foreground', '#000000') // Force black text on brand color

        // Advanced Theming
        // 1. Selection color
        const styleId = 'tenant-styles'
        let styleTag = document.getElementById(styleId)
        if (!styleTag) {
            styleTag = document.createElement('style')
            styleTag.id = styleId
            document.head.appendChild(styleTag)
        }
        styleTag.innerHTML = `
            ::selection {
                background-color: ${tenant.primaryColor} !important;
                color: #ffffff !important;
            }
            .tenant-border {
                border-color: ${tenant.primaryColor} !important;
            }
        `

    }, [tenant])

    return (
        <TenantContext.Provider value={{ tenant, isLoading, loginAsTimestamp, refreshTenant, logout }}>
            {children}
        </TenantContext.Provider>
    )
}

export const useTenant = () => React.useContext(TenantContext)
