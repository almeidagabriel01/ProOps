"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Tenant, TenantNiche, NICHE_LABELS } from "@/types"
export interface TenantFormData {
    name: string
    color: string
    logoUrl?: string
    niche: TenantNiche
    email?: string
    password?: string
}

interface TenantDialogProps {
    isOpen: boolean
    onClose: () => void
    initialData?: Tenant | null
    onSave: (data: TenantFormData) => void
}

export function TenantDialog({ isOpen, onClose, initialData, onSave }: TenantDialogProps) {
    const [formData, setFormData] = React.useState({
        name: "",
        color: "#3b82f6",
        logoUrl: "",
        niche: "automacao_residencial" as TenantNiche,
        email: "",
        password: ""
    })

    // Reset or Load data when dialog opens
    React.useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    color: initialData.primaryColor,
                    logoUrl: initialData.logoUrl || "",
                    niche: initialData.niche || "automacao_residencial",
                    email: "", // User details not editable here for simplicity
                    password: "" // User details not editable here for simplicity
                })
            } else {
                setFormData({
                    name: "",
                    color: "#3b82f6",
                    logoUrl: "",
                    niche: "automacao_residencial" as TenantNiche,
                    email: "",
                    password: ""
                })
            }
        }
    }, [isOpen, initialData])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave(formData)
        onClose()
    }

    const isEditing = !!initialData

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Atualize as informações da empresa."
                            : "Preencha os dados criar um novo ambiente isolado."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Nome</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="color" className="text-right">Cor</Label>
                            <div className="col-span-3 flex gap-2">
                                <Input
                                    id="color"
                                    type="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="w-12 h-10 p-1 cursor-pointer"
                                />
                                <Input
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="font-mono"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="logo" className="text-right">Logo</Label>
                            <div className="col-span-3 space-y-2">
                                <div className="flex items-center gap-3">
                                    {/* Preview */}
                                    {formData.logoUrl ? (
                                        <div className="relative w-16 h-16 rounded-lg border overflow-hidden bg-muted">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={formData.logoUrl}
                                                alt="Logo preview"
                                                className="w-full h-full object-contain"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, logoUrl: "" })}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center hover:bg-destructive/80"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                                            <span className="text-2xl text-muted-foreground">
                                                {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
                                            </span>
                                        </div>
                                    )}
                                    {/* Upload button */}
                                    <div className="flex-1">
                                        <Input
                                            id="logo"
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file) {
                                                    // Validate size (max 300KB)
                                                    if (file.size > 300 * 1024) {
                                                        alert("O logo deve ter no máximo 300KB.")
                                                        e.target.value = ""
                                                        return
                                                    }
                                                    // Convert to Base64
                                                    const reader = new FileReader()
                                                    reader.onload = (event) => {
                                                        setFormData({ ...formData, logoUrl: event.target?.result as string })
                                                    }
                                                    reader.readAsDataURL(file)
                                                }
                                            }}
                                            className="cursor-pointer"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            PNG, JPG ou SVG. Máximo 300KB.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="niche" className="text-right">Nicho</Label>
                            <Select
                                id="niche"
                                value={formData.niche}
                                onChange={(e) => setFormData({ ...formData, niche: e.target.value as TenantNiche })}
                                className="col-span-3"
                                required
                            >
                                {(Object.keys(NICHE_LABELS) as TenantNiche[]).map((key) => (
                                    <option key={key} value={key}>
                                        {NICHE_LABELS[key]}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        {/* Credenciais apenas na criação */}
                        {!isEditing && (
                            <>
                                <div className="border-t my-2"></div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="email" className="text-right">Admin Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@empresa.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="password" className="text-right">Senha</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit">{isEditing ? "Salvar Alterações" : "Criar Empresa"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
