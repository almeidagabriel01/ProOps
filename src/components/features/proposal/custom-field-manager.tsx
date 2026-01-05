"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { CustomFieldType, CustomFieldItem } from "@/types"
import { CustomFieldService } from "@/services/custom-field-service"
import { useTenant } from "@/providers/tenant-provider"
import { Plus, Trash2, Edit2, Image, Settings, X, Check } from "lucide-react"

export function CustomFieldManager() {
    const { tenant } = useTenant()
    const [fieldTypes, setFieldTypes] = React.useState<CustomFieldType[]>([])
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedType, setSelectedType] = React.useState<CustomFieldType | null>(null)
    const [newTypeName, setNewTypeName] = React.useState("")
    const [newItemLabel, setNewItemLabel] = React.useState("")

    React.useEffect(() => {
        if (tenant) {
            CustomFieldService.getCustomFieldTypes(tenant.id).then(setFieldTypes)
        }
    }, [tenant])

    const handleCreateType = async () => {
        if (!tenant || !newTypeName.trim()) return
        const newType = await CustomFieldService.createCustomFieldType({
            tenantId: tenant.id,
            name: newTypeName.trim(),
            items: [],
            createdAt: new Date().toISOString()
        })
        setFieldTypes(prev => [...prev, newType])
        setNewTypeName("")
    }

    const handleDeleteType = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este tipo de campo e todos os seus itens?")) {
            await CustomFieldService.deleteCustomFieldType(id)
            setFieldTypes(prev => prev.filter(t => t.id !== id))
            if (selectedType?.id === id) setSelectedType(null)
        }
    }

    const handleAddItem = async () => {
        if (!selectedType || !newItemLabel.trim()) return

        // We need to update the whole type because Firestore is document-based
        // Ideally we would have a subcollection or array union, but let's update the array
        const newItem: CustomFieldItem = {
            id: Math.random().toString(36).substr(2, 9),
            label: newItemLabel.trim()
        }

        const updatedItems = [...selectedType.items, newItem]
        await CustomFieldService.updateCustomFieldType(selectedType.id, { items: updatedItems })

        setSelectedType(prev => prev ? { ...prev, items: updatedItems } : null)
        setFieldTypes(prev => prev.map(t =>
            t.id === selectedType.id ? { ...t, items: updatedItems } : t
        ))
        setNewItemLabel("")
    }

    const handleDeleteItem = async (itemId: string) => {
        if (!selectedType) return

        const updatedItems = selectedType.items.filter(i => i.id !== itemId)
        await CustomFieldService.updateCustomFieldType(selectedType.id, { items: updatedItems })

        setSelectedType(prev => prev ? { ...prev, items: updatedItems } : null)
        setFieldTypes(prev => prev.map(t =>
            t.id === selectedType.id ? { ...t, items: updatedItems } : t
        ))
    }

    const handleImageUpload = (itemId: string, file: File) => {
        if (!selectedType) return

        const reader = new FileReader()
        reader.onload = async (e) => {
            const base64 = e.target?.result as string

            const updatedItems = selectedType.items.map(i => i.id === itemId ? { ...i, image: base64 } : i)
            await CustomFieldService.updateCustomFieldType(selectedType.id, { items: updatedItems })

            setSelectedType(prev => prev ? { ...prev, items: updatedItems } : null)
            setFieldTypes(prev => prev.map(t =>
                t.id === selectedType.id ? {
                    ...t,
                    items: updatedItems
                } : t
            ))
        }
        reader.readAsDataURL(file)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Campos Personalizados
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Gerenciar Campos Personalizados</DialogTitle>
                    <DialogDescription>
                        Crie tipos de campos específicos para sua empresa (ex: Ambiente, Sistema)
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                    {/* Left: Field Types List */}
                    <div className="w-1/3 border-r pr-4 overflow-auto">
                        <div className="space-y-2 mb-4">
                            <Label>Tipos de Campo</Label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Nome do tipo..."
                                        value={newTypeName}
                                        onChange={(e) => setNewTypeName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateType()}
                                    />
                                </div>
                                <Button size="icon" onClick={handleCreateType}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            {fieldTypes.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Nenhum tipo criado
                                </p>
                            )}
                            {fieldTypes.map(type => (
                                <div
                                    key={type.id}
                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${selectedType?.id === type.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                                        }`}
                                    onClick={() => setSelectedType(type)}
                                >
                                    <span className="text-sm font-medium">{type.name}</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            {type.items.length}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteType(type.id)
                                            }}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Items for Selected Type */}
                    <div className="flex-1 overflow-auto">
                        {selectedType ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">{selectedType.name}</h3>
                                </div>

                                <div className="flex gap-2 items-center">
                                    <div className="flex-1">
                                        <Input
                                            placeholder={`Novo item de ${selectedType.name}...`}
                                            value={newItemLabel}
                                            onChange={(e) => setNewItemLabel(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                        />
                                    </div>
                                    <Button onClick={handleAddItem}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Adicionar
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {selectedType.items.map(item => (
                                        <ItemCard
                                            key={item.id}
                                            item={item}
                                            onDelete={() => handleDeleteItem(item.id)}
                                            onImageUpload={(file) => handleImageUpload(item.id, file)}
                                        />
                                    ))}
                                </div>

                                {selectedType.items.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Adicione itens para &quot;{selectedType.name}&quot;
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <p>Selecione um tipo de campo</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface ItemCardProps {
    item: CustomFieldItem
    onDelete: () => void
    onImageUpload: (file: File) => void
}

function ItemCard({ item, onDelete, onImageUpload }: ItemCardProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    return (
        <Card className="group">
            <CardContent className="p-3">
                <div className="flex items-start gap-3">
                    {/* Image */}
                    <div
                        className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-muted"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt={item.label} className="w-full h-full object-cover" />
                        ) : (
                            <Image className="w-6 h-6 text-muted-foreground" />
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                    if (!file.type.startsWith("image/")) {
                                        alert("O arquivo deve ser uma imagem.");
                                        e.target.value = "";
                                        return;
                                    }
                                    onImageUpload(file)
                                }
                            }}
                        />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{item.label}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                                onClick={onDelete}
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {item.image ? "Com imagem" : "Sem imagem"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
