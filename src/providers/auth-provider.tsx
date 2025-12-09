"use client"

import * as React from "react"
import { MockDB, User } from "@/lib/mock-db"
import { useTenant } from "@/providers/tenant-provider"
import { useRouter } from "next/navigation"

interface AuthContextType {
    user: User | null
    isLoading: boolean
    login: (email: string, pass: string) => Promise<boolean>
    logout: () => void
}

const AuthContext = React.createContext<AuthContextType>({
    user: null,
    isLoading: true,
    login: async () => false,
    logout: () => { }
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<User | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const { refreshTenant } = useTenant()
    const router = useRouter()

    React.useEffect(() => {
        const storedUser = MockDB.getCurrentUser()
        if (storedUser) {
            setUser(storedUser)
            // Ensure tenant is also set
            if (!MockDB.getCurrentTenantId()) {
                MockDB.setCurrentTenantId(storedUser.tenantId)
                refreshTenant()
            }
        }
        setIsLoading(false)
    }, [refreshTenant])

    const login = async (email: string, pass: string) => {
        setIsLoading(true)
        // Simulate network delay
        await new Promise(r => setTimeout(r, 800))

        const authenticatedUser = MockDB.authenticate(email, pass)

        if (authenticatedUser) {
            setUser(authenticatedUser)
            MockDB.setCurrentUser(authenticatedUser.id)

            if (authenticatedUser.role === 'superadmin') {
                // Super Admin Logic
                setIsLoading(false)
                return true // Caller handles redirect? Or we do it here?
                // Page handles redirect usually, but let's check Login Page.
                // Actually, the Login Page does router.push('/'). We should return role or handle it there.
                // Or better: save user, then Login Page checks user.role.
                // But Login Page waits for 'success' boolean.
                // Let's keep it simple: The Login Page logic needs to change OR we change behavior here?
                // AuthProvider just provides state. Login Page decides where to go.
                // I will update Login Page next.
            } else {
                // Tenant Logic
                MockDB.setCurrentTenantId(authenticatedUser.tenantId)
                refreshTenant()
            }

            setIsLoading(false)
            return true
        }

        setIsLoading(false)
        return false
    }

    const logout = () => {
        MockDB.logout()
        setUser(null)
        router.push('/login')
        refreshTenant() // Will clear tenant state
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => React.useContext(AuthContext)
