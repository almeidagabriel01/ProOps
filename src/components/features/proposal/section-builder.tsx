"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ProposalSection, ProposalSectionType, TextStyle, ImageStyle } from "@/lib/mock-db"
import { StyleToolbar } from "./style-toolbar"
import { CustomFieldSection } from "./custom-field-section"
import { HierarchicalFieldSection } from "./hierarchical-field-section"
import {
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Type,
    Table,
    Image,
    List,
    Minus,
    GripVertical,
    Upload,
    Layers,
    Palette,
    GitBranch
} from "lucide-react"

interface SectionBuilderProps {
    sections: ProposalSection[]
    onChange: (sections: ProposalSection[]) => void
}

const sectionTypes: { type: ProposalSectionType; label: string; icon: React.ReactNode; description: string }[] = [
    { type: "header", label: "Cabeçalho", icon: <Type className="w-4 h-4" />, description: "Título de seção" },
    { type: "text", label: "Texto", icon: <Type className="w-4 h-4" />, description: "Parágrafo de texto" },
    { type: "table", label: "Tabela", icon: <Table className="w-4 h-4" />, description: "Tabela de itens/preços" },
    { type: "image", label: "Imagem", icon: <Image className="w-4 h-4" />, description: "Upload de imagem" },
    { type: "list", label: "Lista", icon: <List className="w-4 h-4" />, description: "Lista de itens" },
    { type: "custom-field", label: "Campo Simples", icon: <Layers className="w-4 h-4" />, description: "Campo único" },
    { type: "hierarchical-field", label: "Ambiente + Sistema", icon: <GitBranch className="w-4 h-4" />, description: "Campos vinculados" },
    { type: "separator", label: "Separador", icon: <Minus className="w-4 h-4" />, description: "Linha divisória" },
]

export function SectionBuilder({ sections, onChange }: SectionBuilderProps) {
    const addSection = (type: ProposalSectionType) => {
        const newSection: ProposalSection = {
            id: crypto.randomUUID(),
            type,
            title: getDefaultTitle(type),
            content: getDefaultContent(type),
            order: sections.length
        }
        onChange([...sections, newSection])
    }

    const updateSection = (id: string, updates: Partial<ProposalSection>) => {
        onChange(sections.map(s => s.id === id ? { ...s, ...updates } : s))
    }

    const deleteSection = (id: string) => {
        onChange(sections.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })))
    }

    const moveSection = (id: string, direction: "up" | "down") => {
        const index = sections.findIndex(s => s.id === id)
        if (index === -1) return
        if (direction === "up" && index === 0) return
        if (direction === "down" && index === sections.length - 1) return

        const newSections = [...sections]
        const swapIndex = direction === "up" ? index - 1 : index + 1

            ;[newSections[index], newSections[swapIndex]] = [newSections[swapIndex], newSections[index]]

        onChange(newSections.map((s, i) => ({ ...s, order: i })))
    }

    return (
        <div className="space-y-4">
            {/* Add Section Buttons */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Adicionar Seção</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                        {sectionTypes.map(({ type, label, icon }) => (
                            <Button
                                key={type}
                                variant="outline"
                                size="sm"
                                onClick={() => addSection(type)}
                                className="gap-2"
                            >
                                {icon}
                                {label}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Section List */}
            <div className="space-y-3">
                {sections.length === 0 && (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Plus className="w-8 h-8 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground text-sm">
                                Adicione seções para construir sua proposta
                            </p>
                        </CardContent>
                    </Card>
                )}

                {sections.map((section, index) => (
                    <Card key={section.id} className="group">
                        <CardHeader className="py-3 flex flex-row items-center gap-2">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1">
                                <Input
                                    value={section.title}
                                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                    className="h-8 text-sm font-medium bg-transparent border-none px-0 focus-visible:ring-0"
                                    placeholder="Título da seção"
                                />
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection(section.id, "up")}
                                    disabled={index === 0}
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection(section.id, "down")}
                                    disabled={index === sections.length - 1}
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteSection(section.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <SectionEditor section={section} onUpdate={(updates) => updateSection(section.id, updates)} />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

interface SectionEditorProps {
    section: ProposalSection
    onUpdate: (updates: Partial<ProposalSection>) => void
}

interface ParsedContent {
    text?: string
    data?: string // Base64 image data
    url?: string  // Legacy URL support
    caption?: string
    items?: string[] | TableItem[]
    showTotal?: boolean
    fieldTypeId?: string
    selectedItems?: string[]
    // Hierarchical fields
    environmentTypeId?: string
    systemTypeId?: string
    entries?: { id: string; environmentItemId: string; systemItems: string[] }[]
}

function SectionEditor({ section, onUpdate }: SectionEditorProps) {
    const content = parseContent(section.content) as ParsedContent
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const handleImageUpload = (file: File) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const base64 = e.target?.result as string
            onUpdate({ content: JSON.stringify({ ...content, data: base64 }) })
        }
        reader.readAsDataURL(file)
    }

    switch (section.type) {
        case "header":
            return (
                <div className="space-y-2">
                    <StyleToolbar
                        textStyle={section.textStyle}
                        onTextStyleChange={(textStyle) => onUpdate({ textStyle })}
                        showTextControls
                        showImageControls={false}
                    />
                    <Input
                        value={(content.text as string) || ""}
                        onChange={(e) => onUpdate({ content: JSON.stringify({ text: e.target.value }) })}
                        placeholder="Texto do cabeçalho"
                        className="text-lg font-semibold"
                        style={{
                            color: section.textStyle?.color,
                            fontSize: section.textStyle?.fontSize,
                            fontWeight: section.textStyle?.fontWeight,
                            fontStyle: section.textStyle?.fontStyle,
                            textAlign: section.textStyle?.textAlign,
                            textDecoration: section.textStyle?.textDecoration
                        }}
                    />
                </div>
            )

        case "text":
            return (
                <div className="space-y-2">
                    <StyleToolbar
                        textStyle={section.textStyle}
                        onTextStyleChange={(textStyle) => onUpdate({ textStyle })}
                        showTextControls
                        showImageControls={false}
                    />
                    <Textarea
                        value={(content.text as string) || ""}
                        onChange={(e) => onUpdate({ content: JSON.stringify({ text: e.target.value }) })}
                        placeholder="Digite o texto..."
                        className="min-h-[100px]"
                        style={{
                            color: section.textStyle?.color,
                            fontSize: section.textStyle?.fontSize,
                            fontWeight: section.textStyle?.fontWeight,
                            fontStyle: section.textStyle?.fontStyle,
                            textAlign: section.textStyle?.textAlign,
                            textDecoration: section.textStyle?.textDecoration
                        }}
                    />
                </div>
            )

        case "image": {
            const imageData = content.data || content.url || ""
            const caption = (content.caption as string) || ""
            return (
                <div className="space-y-3">
                    {/* Image Upload */}
                    <div
                        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {imageData ? (
                            <div className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={imageData}
                                    alt="Preview"
                                    className="max-h-48 mx-auto object-contain rounded"
                                    style={{
                                        width: section.imageStyle?.width ? `${section.imageStyle.width}%` : 'auto',
                                        borderRadius: section.imageStyle?.borderRadius,
                                        boxShadow: section.imageStyle?.shadow ? '0 4px 12px rgba(0,0,0,0.3)' : undefined
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="py-8">
                                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    Clique para fazer upload de uma imagem
                                </p>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleImageUpload(file)
                            }}
                        />
                    </div>

                    {/* Image Style Controls */}
                    {imageData && (
                        <StyleToolbar
                            imageStyle={section.imageStyle}
                            onImageStyleChange={(imageStyle) => onUpdate({ imageStyle })}
                            showTextControls={false}
                            showImageControls
                        />
                    )}

                    {/* Caption */}
                    <Input
                        value={caption}
                        onChange={(e) => onUpdate({ content: JSON.stringify({ ...content, caption: e.target.value }) })}
                        placeholder="Legenda (opcional)"
                    />
                </div>
            )
        }

        case "list":
            return <ListEditor content={{ items: content.items as string[] }} onUpdate={(c) => onUpdate({ content: JSON.stringify(c) })} />

        case "table":
            return <TableEditor content={{ items: content.items as TableItem[], showTotal: content.showTotal }} onUpdate={(c) => onUpdate({ content: JSON.stringify(c) })} />

        case "custom-field":
            return (
                <CustomFieldSection
                    content={{ fieldTypeId: content.fieldTypeId, selectedItems: content.selectedItems }}
                    onUpdate={(c) => onUpdate({ content: JSON.stringify(c) })}
                />
            )

        case "hierarchical-field":
            return (
                <HierarchicalFieldSection
                    content={{
                        environmentTypeId: content.environmentTypeId as string | undefined,
                        systemTypeId: content.systemTypeId as string | undefined,
                        entries: content.entries as { id: string; environmentItemId: string; systemItems: string[] }[] | undefined
                    }}
                    onUpdate={(c) => onUpdate({ content: JSON.stringify(c) })}
                />
            )

        case "separator":
            return (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Minus className="w-4 h-4" />
                    <span>Linha divisória</span>
                </div>
            )

        default:
            return null
    }
}

interface ListEditorProps {
    content: { items?: string[] }
    onUpdate: (content: { items: string[] }) => void
}

function ListEditor({ content, onUpdate }: ListEditorProps) {
    const items = content.items || [""]

    const updateItem = (index: number, value: string) => {
        const newItems = [...items]
        newItems[index] = value
        onUpdate({ items: newItems })
    }

    const addItem = () => {
        onUpdate({ items: [...items, ""] })
    }

    const removeItem = (index: number) => {
        if (items.length === 1) return
        onUpdate({ items: items.filter((_, i) => i !== index) })
    }

    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                    <span className="text-muted-foreground mt-2">•</span>
                    <Input
                        value={item}
                        onChange={(e) => updateItem(index, e.target.value)}
                        placeholder="Item da lista"
                        className="flex-1"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Item
            </Button>
        </div>
    )
}

interface TableItem {
    id: string
    name: string
    description: string
    quantity: number
    unitPrice: number
}

interface TableEditorProps {
    content: { items?: TableItem[]; showTotal?: boolean }
    onUpdate: (content: { items: TableItem[]; showTotal: boolean }) => void
}

function TableEditor({ content, onUpdate }: TableEditorProps) {
    const items = content.items || []
    const showTotal = content.showTotal ?? true

    const addItem = () => {
        const newItem: TableItem = {
            id: crypto.randomUUID(),
            name: "",
            description: "",
            quantity: 1,
            unitPrice: 0
        }
        onUpdate({ items: [...items, newItem], showTotal })
    }

    const updateItem = (id: string, updates: Partial<TableItem>) => {
        onUpdate({
            items: items.map(item => item.id === id ? { ...item, ...updates } : item),
            showTotal
        })
    }

    const removeItem = (id: string) => {
        onUpdate({ items: items.filter(item => item.id !== id), showTotal })
    }

    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

    return (
        <div className="space-y-3">
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum item adicionado
                </p>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted">
                            <tr>
                                <th className="text-left px-3 py-2 font-medium">Item</th>
                                <th className="text-center px-3 py-2 font-medium w-20">Qtd</th>
                                <th className="text-right px-3 py-2 font-medium w-28">Preço Unit.</th>
                                <th className="text-right px-3 py-2 font-medium w-28">Total</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {items.map((item) => (
                                <tr key={item.id} className="group">
                                    <td className="px-3 py-2">
                                        <Input
                                            value={item.name}
                                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                            placeholder="Nome do item"
                                            className="h-8 text-sm"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                                            className="h-8 text-sm text-center"
                                            min={1}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <Input
                                            type="number"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                                            className="h-8 text-sm text-right"
                                            step="0.01"
                                            min={0}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium">
                                        R$ {(item.quantity * item.unitPrice).toFixed(2)}
                                    </td>
                                    <td className="px-2 py-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                            onClick={() => removeItem(item.id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {showTotal && items.length > 0 && (
                            <tfoot className="bg-muted/50">
                                <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right font-semibold">Total</td>
                                    <td className="px-3 py-2 text-right font-bold text-lg">
                                        R$ {total.toFixed(2)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
            <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Item
            </Button>
        </div>
    )
}

function getDefaultTitle(type: ProposalSectionType): string {
    const titles: Record<ProposalSectionType, string> = {
        header: "Título",
        text: "Descrição",
        table: "Itens e Valores",
        image: "Imagem",
        list: "Lista",
        "custom-field": "Campo Personalizado",
        "hierarchical-field": "Ambientes e Sistemas",
        separator: ""
    }
    return titles[type]
}

function getDefaultContent(type: ProposalSectionType): string {
    const defaults: Record<ProposalSectionType, object> = {
        header: { text: "" },
        text: { text: "" },
        table: { items: [], showTotal: true },
        image: { data: "", caption: "" },
        list: { items: [""] },
        "custom-field": { fieldTypeId: "", selectedItems: [] },
        "hierarchical-field": { environmentTypeId: "", systemTypeId: "", entries: [] },
        separator: {}
    }
    return JSON.stringify(defaults[type])
}

function parseContent(content: string): Record<string, unknown> {
    try {
        return JSON.parse(content)
    } catch {
        return {}
    }
}
