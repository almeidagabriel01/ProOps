"use client"

import * as React from "react"
import { MockDB, Tenant } from "@/lib/mock-db"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTenant } from "@/providers/tenant-provider"
import { Plus, LogIn, Trash2, Pencil, Search, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { TenantDialog, TenantFormData } from "@/components/admin/tenant-dialog"

export default function AdminPage() {
    const [tenants, setTenants] = React.useState<Tenant[]>([])
    const [search, setSearch] = React.useState("")
    const [isDialogOpen, setIsDialogOpen] = React.useState(false)
    const [editingTenant, setEditingTenant] = React.useState<Tenant | null>(null)

    const { refreshTenant } = useTenant()
    const router = useRouter()

    const loadTenants = () => {
        setTenants(MockDB.getTenants())
    }

    React.useEffect(() => {
        loadTenants()
    }, [])

    const handleSave = (data: TenantFormData) => {
        if (editingTenant) {
            // Edit Mode
            MockDB.updateTenant(editingTenant.id, {
                name: data.name,
                primaryColor: data.color,
                logoUrl: data.logoUrl
            })
            alert("Empresa atualizada com sucesso!")
        } else {
            // Create Mode
            const newTenant = MockDB.createTenant(data.name, data.color, data.logoUrl)
            if (data.email) {
                MockDB.createUser(newTenant.id, data.email, `Admin ${newTenant.name}`, data.password)
            }
            alert(`Empresa ${newTenant.name} criada!`)
        }
        loadTenants()
    }

    const handleDelete = (id: string) => {
        if (!confirm("Tem certeza? Esta ação removerá a empresa e todos os seus dados.")) return
        MockDB.deleteTenant(id)
        loadTenants()
    }

    const openCreate = () => {
        setEditingTenant(null)
        setIsDialogOpen(true)
    }

    const openEdit = (tenant: Tenant) => {
        setEditingTenant(tenant)
        setIsDialogOpen(true)
    }

    const handleLoginAs = (tenant: Tenant) => {
        MockDB.setViewingAsTenant(tenant.id)
        refreshTenant()
        router.push('/')
    }

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-6">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Building2 className="w-8 h-8 text-primary" />
                        Painel Super Admin
                    </h1>
                    <p className="text-muted-foreground mt-1">Gerencie múltiplos inquilinos (Tenants) em um só lugar.</p>
                </div>
                <Button onClick={openCreate} size="lg" className="shadow-lg hover:shadown-xl transition-all">
                    <Plus className="w-5 h-5 mr-2" /> Nova Empresa
                </Button>
            </div>

            {/* Filters */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Pesquisar empresas..."
                    className="pl-10 h-10 bg-muted/50"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Grid List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredTenants.map(tenant => (
                    <Card key={tenant.id} className="overflow-hidden border-t-4 hover:shadow-md transition-shadow group flex flex-col" style={{ borderTopColor: tenant.primaryColor }}>
                        <CardHeader className="pb-2 pt-6">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border p-1">
                                    {tenant.logoUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={tenant.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-xl font-bold text-muted-foreground">{tenant.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(tenant)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(tenant.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-4">
                                <h3 className="font-bold text-lg leading-tight truncate" title={tenant.name}>{tenant.name}</h3>
                                <p className="text-xs text-muted-foreground font-mono mt-1">ID: {tenant.slug}</p>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span>Ativo desde: {new Date(tenant.createdAt).toLocaleDateString()}</span>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 p-4 border-t">
                            <Button className="w-full cursor-pointer group-hover:bg-primary group-hover:text-primary-foreground transition-colors" variant="outline" onClick={() => handleLoginAs(tenant)}>
                                <LogIn className="w-4 h-4 mr-2" /> Acessar Painel
                            </Button>
                        </CardFooter>
                    </Card>
                ))}

                {filteredTenants.length === 0 && (
                    <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                        <Building2 className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Nenhuma empresa encontrada.</p>
                        <p className="text-sm">Tente ajustar o filtro ou crie uma nova empresa.</p>
                    </div>
                )}
            </div>

            <TenantDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                initialData={editingTenant}
                onSave={handleSave}
            />
        </div>
    )
}
