"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import {
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Image as ImageIcon,
    Type,
    FileText,
    GripVertical,
    Bold,
    Italic,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Upload,
    ArrowUpToLine,
    ArrowDownToLine,
    GripHorizontal
} from "lucide-react"

export interface PdfSection {
    id: string
    type: 'title' | 'text' | 'image' | 'divider'
    content: string
    imageUrl?: string
    // Layout - allows sections to be placed in columns
    columnWidth?: number  // Percentage 10-100, sections with widths that sum to ~100 appear in same row
    styles: {
        fontSize?: string
        fontWeight?: string
        fontStyle?: string
        textAlign?: 'left' | 'center' | 'right'
        color?: string
        backgroundColor?: string
        padding?: string
        marginTop?: string
        marginBottom?: string
        // Image-specific styles
        imageWidth?: number  // Percentage 10-100
        imageAlign?: 'left' | 'center' | 'right'
        imageBorderRadius?: string
        imageBorder?: boolean
        // Layout alignment
        verticalAlign?: 'top' | 'center' | 'bottom'
    }
}

interface PdfSectionEditorProps {
    sections: PdfSection[]
    onChange: (sections: PdfSection[]) => void
    primaryColor: string
}

const fontSizeOptions = [
    { value: '12px', label: 'Pequeno' },
    { value: '14px', label: 'Normal' },
    { value: '16px', label: 'Médio' },
    { value: '18px', label: 'Grande' },
    { value: '24px', label: 'Título' },
    { value: '32px', label: 'Destaque' },
]

export function PdfSectionEditor({ sections, onChange, primaryColor }: PdfSectionEditorProps) {
    const [expandedSection, setExpandedSection] = React.useState<string | null>(null)
    const [draggedId, setDraggedId] = React.useState<string | null>(null)
    const [dragOverId, setDragOverId] = React.useState<string | null>(null)
    const [dropPlacement, setDropPlacement] = React.useState<'top' | 'bottom' | 'left' | 'right' | null>(null)
    const [hoveredHandleId, setHoveredHandleId] = React.useState<string | null>(null)

    const addSection = (type: PdfSection['type']) => {
        const newSection: PdfSection = {
            id: crypto.randomUUID(),
            type,
            content: type === 'title' ? 'Novo Título' : type === 'text' ? 'Novo parágrafo de texto...' : '',
            styles: {
                fontSize: type === 'title' ? '24px' : '14px',
                fontWeight: type === 'title' ? 'bold' : 'normal',
                textAlign: type === 'title' ? 'left' : 'left',
                color: type === 'title' ? primaryColor : '#374151',
                marginTop: '16px',
                marginBottom: '8px'
            }
        }
        onChange([...sections, newSection])
        setExpandedSection(newSection.id)
    }

    const healLayout = (currentSections: PdfSection[]) => {
        return currentSections.map((section, index) => {
            if (!section.columnWidth || section.columnWidth === 100) return section

            // It's partial. Check neighbors.
            const prev = currentSections[index - 1]
            const next = currentSections[index + 1]

            const prevIsPartial = prev && prev.columnWidth && prev.columnWidth < 100
            const nextIsPartial = next && next.columnWidth && next.columnWidth < 100

            if (!prevIsPartial && !nextIsPartial) {
                // Orphaned -> Reset to 100
                return { ...section, columnWidth: 100 }
            }
            return section
        })
    }

    const removeSection = (id: string) => {
        const newSections = sections.filter(s => s.id !== id)
        onChange(healLayout(newSections))
    }

    const moveSection = (id: string, direction: 'up' | 'down') => {
        const index = sections.findIndex(s => s.id === id)
        if (index === -1) return
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === sections.length - 1) return

        const newSections = [...sections]
        const swapIndex = direction === 'up' ? index - 1 : index + 1
            ;[newSections[index], newSections[swapIndex]] = [newSections[swapIndex], newSections[index]]
        onChange(healLayout(newSections))
    }

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, id: string) => {
        // Only allow drag if handle is targeted (we'll implement this restriction in the JSX)
        // For now, assume if this fires, it's valid, but we will add logic.
        setDraggedId(id)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
        // Set drag image to the whole card if possible?
        // Default behavior usually works if draggable is on Card.
    }

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault()
        if (draggedId && draggedId !== id) {
            setDragOverId(id)

            // Calculate drop placement
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const offsetX = e.clientX - rect.left
            const offsetY = e.clientY - rect.top

            // Side drop thresholds (30%)
            if (offsetX < rect.width * 0.3) {
                setDropPlacement('left')
            } else if (offsetX > rect.width * 0.7) {
                setDropPlacement('right')
            } else if (offsetY < rect.height * 0.5) {
                setDropPlacement('top')
            } else {
                setDropPlacement('bottom')
            }
        }
    }

    const handleDragLeave = () => {
        setDragOverId(null)
        setDropPlacement(null)
    }

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (!draggedId || draggedId === targetId) return

        const draggedIndex = sections.findIndex(s => s.id === draggedId)
        const targetIndex = sections.findIndex(s => s.id === targetId)

        if (draggedIndex === -1 || targetIndex === -1) return

        const targetSection = sections[targetIndex]
        const newSections = [...sections]
        const [removed] = newSections.splice(draggedIndex, 1)

        // Use dropPlacement calculated in dragOver if available
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const offsetX = e.clientX - rect.left

        const isSideDrop = (offsetX < rect.width * 0.3) || (offsetX > rect.width * 0.7)

        if (isSideDrop) {
            removed.columnWidth = 50
            if (!targetSection.columnWidth || targetSection.columnWidth === 100) {
                // Determine actual target index
                const adjust = draggedIndex < targetIndex ? -1 : 0
                const actualTargetIndex = targetIndex + adjust
                if (newSections[actualTargetIndex]) {
                    newSections[actualTargetIndex] = { ...newSections[actualTargetIndex], columnWidth: 50 }
                }
            } else {
                removed.columnWidth = targetSection.columnWidth
            }
        } else {
            removed.columnWidth = 100
        }

        newSections.splice(targetIndex, 0, removed)

        // Heal layout
        onChange(healLayout(newSections))
        setDraggedId(null)
        setDragOverId(null)
        setDropPlacement(null)
    }

    const handleContainerDrop = (e: React.DragEvent) => {
        e.preventDefault()
        if (!draggedId) return

        const draggedIndex = sections.findIndex(s => s.id === draggedId)
        if (draggedIndex === -1) return

        const newSections = [...sections]
        const [removed] = newSections.splice(draggedIndex, 1)

        // Reset to full width (new line)
        removed.columnWidth = 100

        // Move to end of list
        newSections.push(removed)

        onChange(healLayout(newSections))
        setDraggedId(null)
        setDragOverId(null)
    }

    const handleDragEnd = () => {
        setDraggedId(null)
        setDragOverId(null)
    }

    const updateSection = (id: string, updates: Partial<PdfSection>) => {
        onChange(sections.map(s =>
            s.id === id ? { ...s, ...updates } : s
        ))
    }

    const updateStyle = (id: string, styleKey: keyof PdfSection['styles'], value: string) => {
        onChange(sections.map(s =>
            s.id === id ? { ...s, styles: { ...s.styles, [styleKey]: value } } : s
        ))
    }

    const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                updateSection(id, { imageUrl: event.target?.result as string })
            }
            reader.readAsDataURL(file)
        }
    }

    const getSectionIcon = (type: PdfSection['type']) => {
        switch (type) {
            case 'title': return <Type className="w-4 h-4" />
            case 'text': return <FileText className="w-4 h-4" />
            case 'image': return <ImageIcon className="w-4 h-4" />
            case 'divider': return <div className="w-4 h-0.5 bg-current" />
        }
    }

    const getSectionLabel = (type: PdfSection['type']) => {
        switch (type) {
            case 'title': return 'Título'
            case 'text': return 'Texto'
            case 'image': return 'Imagem'
            case 'divider': return 'Divisor'
        }
    }

    return (
        <div className="space-y-4">
            {/* Section list with flex layout to match PDF */}
            <div
                className="flex flex-wrap items-start gap-2 min-h-[100px] p-2 rounded-lg border border-transparent transition-colors"
                onDrop={handleContainerDrop}
                onDragOver={(e) => {
                    e.preventDefault()
                    if (draggedId) {
                        e.currentTarget.classList.add('bg-muted/30', 'border-dashed', 'border-muted')
                    }
                }}
                onDragLeave={(e) => {
                    e.currentTarget.classList.remove('bg-muted/30', 'border-dashed', 'border-muted')
                }}
            >
                {sections.map((section, index) => {
                    const isExpanded = expandedSection === section.id
                    const isDragging = draggedId === section.id
                    const isDragOver = dragOverId === section.id
                    const columnWidth = section.columnWidth || 100
                    // Calculate flex basis based on column width
                    const flexBasis = columnWidth === 100 ? '100%' :
                        columnWidth === 50 ? 'calc(50% - 4px)' :
                            columnWidth === 33 ? 'calc(33.33% - 5.33px)' : '100%'
                    return (
                        <Card
                            key={section.id}
                            className={`relative overflow-hidden transition-all ${isDragging ? 'opacity-50 scale-95' : ''} ${isDragOver && !dropPlacement ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                            style={{ flexBasis, minWidth: columnWidth < 100 ? '200px' : undefined }}
                            draggable={hoveredHandleId === section.id}
                            onDragStart={(e) => handleDragStart(e, section.id)}
                            onDragOver={(e) => handleDragOver(e, section.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, section.id)}
                            onDragEnd={handleDragEnd}
                        >
                            {/* Visual Preview of Split/Layout */}
                            {isDragOver && dropPlacement === 'left' && (
                                <div className="absolute left-0 top-0 bottom-0 w-1/2 border-2 border-dashed border-primary bg-primary/5 z-50 pointer-events-none rounded-l">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-background/80 text-primary px-2 py-1 rounded text-xs font-medium border border-primary/20 shadow-sm">1/2 Coluna</div>
                                    </div>
                                </div>
                            )}
                            {isDragOver && dropPlacement === 'right' && (
                                <div className="absolute right-0 top-0 bottom-0 w-1/2 border-2 border-dashed border-primary bg-primary/5 z-50 pointer-events-none rounded-r">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-background/80 text-primary px-2 py-1 rounded text-xs font-medium border border-primary/20 shadow-sm">1/2 Coluna</div>
                                    </div>
                                </div>
                            )}
                            {isDragOver && (dropPlacement === 'top' || dropPlacement === 'bottom') && (
                                <div className={`absolute left-0 right-0 ${dropPlacement === 'top' ? 'top-0' : 'bottom-0'} h-1/2 border-2 border-dashed border-primary bg-primary/5 z-50 pointer-events-none rounded`}>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-background/80 text-primary px-2 py-1 rounded text-xs font-medium border border-primary/20 shadow-sm">Linha Inteira (100%)</div>
                                    </div>
                                </div>
                            )}


                            {/* Section Header */}
                            <div
                                className="flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted transition-colors select-none"
                            >
                                <div
                                    className="flex items-center gap-2 flex-1 outline-none"
                                    title="Arraste para reordenar"
                                    onMouseEnter={() => setHoveredHandleId(section.id)}
                                    onMouseLeave={() => setHoveredHandleId(null)}
                                >
                                    <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted-foreground/10 rounded">
                                        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    </div>
                                    <div
                                        className="flex items-center gap-2 flex-1 cursor-pointer"
                                        onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                                    >
                                        <span className="text-muted-foreground flex-shrink-0">{getSectionIcon(section.type)}</span>
                                        <span className="font-medium text-sm flex-1 truncate">
                                            {getSectionLabel(section.type)}
                                            {section.type !== 'divider' && section.type !== 'image' && section.content && (
                                                <span className="text-muted-foreground font-normal ml-2">
                                                    - {section.content.substring(0, 25)}{section.content.length > 25 ? '...' : ''}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => moveSection(section.id, 'up')}
                                        disabled={index === 0}
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => moveSection(section.id, 'down')}
                                        disabled={index === sections.length - 1}
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => removeSection(section.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Expanded Content Editor */}
                            {isExpanded && (
                                <CardContent className="pt-4 space-y-4 border-t">
                                    {/* Column Layout - simple buttons */}
                                    {/* Layout Control */}
                                    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                                        <div className="flex flex-col gap-2">
                                            <Label className="text-xs font-medium text-muted-foreground">Largura da Coluna</Label>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant={!section.columnWidth || section.columnWidth === 100 ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        updateSection(section.id, { columnWidth: 100 })
                                                    }}
                                                >
                                                    100%
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={section.columnWidth === 50 ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        updateSection(section.id, { columnWidth: 50 })
                                                    }}
                                                >
                                                    1/2
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={section.columnWidth === 33 ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        updateSection(section.id, { columnWidth: 33 })
                                                    }}
                                                >
                                                    1/3
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground pt-1">
                                            💡 Arraste para as laterais para dividir colunas
                                        </p>
                                    </div>

                                    {/* Content based on type */}
                                    {section.type === 'title' && (
                                        <div className="grid gap-2">
                                            <Label>Texto do Título</Label>
                                            <Input
                                                value={section.content}
                                                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                                                placeholder="Digite o título..."
                                            />
                                        </div>
                                    )}

                                    {section.type === 'text' && (
                                        <div className="grid gap-2">
                                            <Label>Conteúdo</Label>
                                            <Textarea
                                                value={section.content}
                                                onChange={(e) => updateSection(section.id, { content: e.target.value })}
                                                placeholder="Digite o texto..."
                                                rows={4}
                                            />
                                        </div>
                                    )}

                                    {section.type === 'image' && (
                                        <div className="space-y-4">
                                            <div className="grid gap-2">
                                                <Label>Imagem</Label>
                                                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                                    {section.imageUrl ? (
                                                        <div className="space-y-3">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={section.imageUrl}
                                                                alt="Section"
                                                                className="max-h-48 mx-auto rounded-lg object-contain"
                                                            />
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => updateSection(section.id, { imageUrl: undefined })}
                                                            >
                                                                Trocar Imagem
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <label className="cursor-pointer block py-4">
                                                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                                            <p className="text-sm text-muted-foreground">Clique para upload</p>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => handleImageUpload(section.id, e)}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Legenda (opcional)</Label>
                                                <Input
                                                    value={section.content}
                                                    onChange={(e) => updateSection(section.id, { content: e.target.value })}
                                                    placeholder="Legenda da imagem..."
                                                />
                                            </div>

                                            {/* Image Style Options */}
                                            <div className="space-y-4 pt-4 border-t">
                                                <Label className="text-muted-foreground">Estilo da Imagem</Label>

                                                {/* Image Size Slider */}
                                                <div className="grid gap-2" onMouseDown={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs">Tamanho da Imagem</Label>
                                                        <span className="text-xs font-medium text-primary">
                                                            {section.styles.imageWidth || 100}%
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="10"
                                                        max="100"
                                                        step="5"
                                                        value={section.styles.imageWidth || 100}
                                                        onChange={(e) => updateSection(section.id, {
                                                            styles: { ...section.styles, imageWidth: parseInt(e.target.value) }
                                                        })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onTouchStart={(e) => e.stopPropagation()}
                                                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                                    />
                                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                                        <span>10%</span>
                                                        <span>50%</span>
                                                        <span>100%</span>
                                                    </div>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label className="text-xs">Bordas Arredondadas</Label>
                                                    <Select
                                                        value={section.styles.imageBorderRadius || '8px'}
                                                        onChange={(e) => updateStyle(section.id, 'imageBorderRadius', e.target.value)}
                                                    >
                                                        <option value="0px">Sem bordas</option>
                                                        <option value="4px">Leve</option>
                                                        <option value="8px">Médio</option>
                                                        <option value="16px">Arredondado</option>
                                                        <option value="9999px">Circular</option>
                                                    </Select>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label className="text-xs">Alinhamento</Label>
                                                    <div className="flex flex-wrap gap-4">
                                                        {/* Horizontal Image Align */}
                                                        <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                                                            <Button
                                                                type="button"
                                                                variant={section.styles.imageAlign === 'left' ? 'default' : 'ghost'}
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => updateStyle(section.id, 'imageAlign', 'left')}
                                                                title="Esquerda"
                                                            >
                                                                <AlignLeft className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant={(!section.styles.imageAlign || section.styles.imageAlign === 'center') ? 'default' : 'ghost'}
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => updateStyle(section.id, 'imageAlign', 'center')}
                                                                title="Centro"
                                                            >
                                                                <AlignCenter className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant={section.styles.imageAlign === 'right' ? 'default' : 'ghost'}
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => updateStyle(section.id, 'imageAlign', 'right')}
                                                                title="Direita"
                                                            >
                                                                <AlignRight className="w-4 h-4" />
                                                            </Button>
                                                        </div>

                                                        <div className="w-px bg-border h-7 hidden sm:block" />

                                                        {/* Vertical Align */}
                                                        <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                                                            <Button
                                                                type="button"
                                                                variant={section.styles.verticalAlign === 'top' || !section.styles.verticalAlign ? 'default' : 'ghost'}
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => updateStyle(section.id, 'verticalAlign', 'top')}
                                                                title="Topo"
                                                            >
                                                                <ArrowUpToLine className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant={section.styles.verticalAlign === 'center' ? 'default' : 'ghost'}
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => updateStyle(section.id, 'verticalAlign', 'center')}
                                                                title="Centro Vertical"
                                                            >
                                                                <GripHorizontal className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant={section.styles.verticalAlign === 'bottom' ? 'default' : 'ghost'}
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => updateStyle(section.id, 'verticalAlign', 'bottom')}
                                                                title="Base"
                                                            >
                                                                <ArrowDownToLine className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        id={`border-${section.id}`}
                                                        checked={section.styles.imageBorder || false}
                                                        onChange={(e) => updateStyle(section.id, 'imageBorder', e.target.checked ? 'true' : '')}
                                                        className="w-4 h-4"
                                                    />
                                                    <Label htmlFor={`border-${section.id}`} className="text-sm cursor-pointer">
                                                        Adicionar borda na imagem
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Style options for text-based sections */}
                                    {(section.type === 'title' || section.type === 'text') && (
                                        <div className="space-y-4 pt-4 border-t">
                                            <Label className="text-muted-foreground">Estilo e Formatação</Label>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label className="text-xs">Tamanho</Label>
                                                    <Select
                                                        value={section.styles.fontSize || '14px'}
                                                        onChange={(e) => updateStyle(section.id, 'fontSize', e.target.value)}
                                                    >
                                                        {fontSizeOptions.map(opt => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </Select>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-xs">Cor do Texto</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="color"
                                                            value={section.styles.color || '#000000'}
                                                            onChange={(e) => updateStyle(section.id, 'color', e.target.value)}
                                                            className="w-12 h-9 p-1"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => updateStyle(section.id, 'color', primaryColor)}
                                                        >
                                                            Primária
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label className="text-xs">Formatação e Alinhamento</Label>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    {/* Text Style */}
                                                    <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                                                        <Button
                                                            variant={section.styles.fontWeight === 'bold' ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => updateStyle(section.id, 'fontWeight',
                                                                section.styles.fontWeight === 'bold' ? 'normal' : 'bold'
                                                            )}
                                                            title="Negrito"
                                                        >
                                                            <Bold className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant={section.styles.fontStyle === 'italic' ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => updateStyle(section.id, 'fontStyle',
                                                                section.styles.fontStyle === 'italic' ? 'normal' : 'italic'
                                                            )}
                                                            title="Itálico"
                                                        >
                                                            <Italic className="w-4 h-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="w-px bg-border h-6 hidden sm:block" />

                                                    {/* Horizontal Align */}
                                                    <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                                                        <Button
                                                            type="button"
                                                            variant={(!section.styles.textAlign || section.styles.textAlign === 'left') ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => updateStyle(section.id, 'textAlign', 'left')}
                                                            title="Esquerda"
                                                        >
                                                            <AlignLeft className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={section.styles.textAlign === 'center' ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => updateStyle(section.id, 'textAlign', 'center')}
                                                            title="Centro"
                                                        >
                                                            <AlignCenter className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={section.styles.textAlign === 'right' ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => updateStyle(section.id, 'textAlign', 'right')}
                                                            title="Direita"
                                                        >
                                                            <AlignRight className="w-4 h-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="w-px bg-border h-6 hidden sm:block" />

                                                    {/* Vertical Align */}
                                                    <div className="flex bg-muted/50 rounded-md p-1 gap-1">
                                                        <Button
                                                            type="button"
                                                            variant={section.styles.verticalAlign === 'top' || !section.styles.verticalAlign ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => updateStyle(section.id, 'verticalAlign', 'top')}
                                                            title="Alinhamento Vertical Topo"
                                                        >
                                                            <ArrowUpToLine className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={section.styles.verticalAlign === 'center' ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => updateStyle(section.id, 'verticalAlign', 'center')}
                                                            title="Alinhamento Vertical Centro"
                                                        >
                                                            <GripHorizontal className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={section.styles.verticalAlign === 'bottom' ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => updateStyle(section.id, 'verticalAlign', 'bottom')}
                                                            title="Alinhamento Vertical Base"
                                                        >
                                                            <ArrowDownToLine className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label className="text-xs">Cor de Fundo (opcional)</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="color"
                                                        value={section.styles.backgroundColor || '#ffffff'}
                                                        onChange={(e) => updateStyle(section.id, 'backgroundColor', e.target.value)}
                                                        className="w-12 h-9 p-1"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => updateStyle(section.id, 'backgroundColor', 'transparent')}
                                                    >
                                                        Transparente
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}                   </CardContent>
                            )
                            }
                        </Card>
                    )
                })}
            </div>

            {/* Add Section Buttons */}
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => addSection('title')} className="gap-2">
                    <Type className="w-4 h-4" />
                    Título
                </Button>
                <Button variant="outline" size="sm" onClick={() => addSection('text')} className="gap-2">
                    <FileText className="w-4 h-4" />
                    Texto
                </Button>
                <Button variant="outline" size="sm" onClick={() => addSection('image')} className="gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Imagem
                </Button>
                <Button variant="outline" size="sm" onClick={() => addSection('divider')} className="gap-2">
                    <div className="w-4 h-0.5 bg-current" />
                    Divisor
                </Button>
            </div>
        </div >
    )
}

// Helper to create default sections from template
export function createDefaultSections(template: {
    introductionText: string
    scopeText: string
    paymentTerms: string
    warrantyText: string
    footerText: string
}, primaryColor: string): PdfSection[] {
    const sections: PdfSection[] = []

    if (template.introductionText) {
        sections.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: template.introductionText,
            styles: { fontSize: '14px', color: '#374151', marginBottom: '16px' }
        })
    }

    if (template.scopeText) {
        sections.push({
            id: crypto.randomUUID(),
            type: 'title',
            content: 'Escopo do Projeto',
            styles: { fontSize: '20px', fontWeight: 'bold', color: primaryColor, marginTop: '24px', marginBottom: '8px' }
        })
        sections.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: template.scopeText,
            styles: { fontSize: '14px', color: '#374151', marginBottom: '16px' }
        })
    }

    if (template.paymentTerms) {
        sections.push({
            id: crypto.randomUUID(),
            type: 'title',
            content: 'Condições de Pagamento',
            styles: { fontSize: '20px', fontWeight: 'bold', color: primaryColor, marginTop: '24px', marginBottom: '8px' }
        })
        sections.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: template.paymentTerms,
            styles: { fontSize: '14px', color: '#374151', marginBottom: '16px' }
        })
    }

    if (template.warrantyText) {
        sections.push({
            id: crypto.randomUUID(),
            type: 'title',
            content: 'Garantia',
            styles: { fontSize: '20px', fontWeight: 'bold', color: primaryColor, marginTop: '24px', marginBottom: '8px' }
        })
        sections.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: template.warrantyText,
            styles: { fontSize: '14px', color: '#374151', marginBottom: '16px' }
        })
    }

    if (template.footerText) {
        sections.push({
            id: crypto.randomUUID(),
            type: 'divider',
            content: '',
            styles: { marginTop: '32px', marginBottom: '16px' }
        })
        sections.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: template.footerText,
            styles: { fontSize: '14px', color: '#374151' }
        })
    }

    return sections
}
