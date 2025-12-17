"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    ChevronUp,
    ChevronDown,
    Trash2,
    GripVertical,
    Image as ImageIcon,
    Type,
    FileText,
    List,
} from "lucide-react"
import { PdfSection } from "../pdf-section-editor"
import { SectionContentEditor } from "./section-content-editor"

interface SectionCardProps {
    section: PdfSection
    index: number
    totalSections: number
    isExpanded: boolean
    isDragging: boolean
    isDragOver: boolean
    dropPlacement: 'top' | 'bottom' | 'left' | 'right' | null
    primaryColor: string
    onExpand: (id: string | null) => void
    onMove: (id: string, direction: 'up' | 'down') => void
    onRemove: (id: string) => void
    onHoverHandle: (id: string | null) => void
    updateSection: (id: string, updates: Partial<PdfSection>) => void
    updateStyle: (id: string, styleKey: keyof PdfSection['styles'], value: string) => void
    handleImageUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
    // Drag handlers
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
}

const getSectionIcon = (type: PdfSection['type']) => {
    switch (type) {
        case 'title': return <Type className="w-4 h-4" />
        case 'text': return <FileText className="w-4 h-4" />
        case 'image': return <ImageIcon className="w-4 h-4" />
        case 'product-table': return <List className="w-4 h-4" />
        case 'divider': return <div className="w-4 h-0.5 bg-current" />
    }
}

const getSectionLabel = (type: PdfSection['type']) => {
    switch (type) {
        case 'title': return 'Título'
        case 'text': return 'Texto'
        case 'image': return 'Imagem'
        case 'product-table': return 'Lista de Produtos'
        case 'divider': return 'Divisor'
    }
}

export function SectionCard({
    section,
    index,
    totalSections,
    isExpanded,
    isDragging,
    isDragOver,
    dropPlacement,
    primaryColor,
    onExpand,
    onMove,
    onRemove,
    onHoverHandle,
    updateSection,
    updateStyle,
    handleImageUpload,
    draggable,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
}: SectionCardProps) {
    const columnWidth = section.columnWidth || 100
    const flexBasis = columnWidth === 100 ? '100%' :
        columnWidth === 50 ? 'calc(50% - 4px)' :
            columnWidth === 33 ? 'calc(33.33% - 5.33px)' : '100%'

    return (
        <Card
            className={`relative overflow-hidden transition-all ${isDragging ? 'opacity-50 scale-95' : ''} ${isDragOver && !dropPlacement ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            style={{ flexBasis, minWidth: columnWidth < 100 ? '200px' : undefined }}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
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
            <div className="flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted transition-colors select-none">
                <div
                    className="flex items-center gap-2 flex-1 outline-none"
                    title="Arraste para reordenar"
                    onMouseEnter={() => onHoverHandle(section.id)}
                    onMouseLeave={() => onHoverHandle(null)}
                >
                    <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted-foreground/10 rounded">
                        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div
                        className="flex items-center gap-2 flex-1 cursor-pointer"
                        onClick={() => onExpand(isExpanded ? null : section.id)}
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
                        onClick={() => onMove(section.id, 'up')}
                        disabled={index === 0}
                    >
                        <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onMove(section.id, 'down')}
                        disabled={index === totalSections - 1}
                    >
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onRemove(section.id)}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Expanded Content Editor */}
            {isExpanded && (
                <CardContent className="pt-4 border-t">
                    <SectionContentEditor
                        section={section}
                        primaryColor={primaryColor}
                        updateSection={updateSection}
                        updateStyle={updateStyle}
                        handleImageUpload={handleImageUpload}
                    />
                </CardContent>
            )}
        </Card>
    )
}
