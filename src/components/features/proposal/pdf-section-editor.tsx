"use client"

import * as React from "react"
import { usePdfSectionEditor, SectionCard, AddSectionButtons } from "./pdf-editor"

export interface PdfSection {
    id: string
    type: 'title' | 'text' | 'image' | 'divider' | 'product-table'
    content: string
    imageUrl?: string
    columnWidth?: number  // Percentage 10-100
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
        imageWidth?: number  // Percentage 10-100
        imageAlign?: 'left' | 'center' | 'right'
        imageBorderRadius?: string
        imageBorder?: boolean
        verticalAlign?: 'top' | 'center' | 'bottom'
    }
}

interface PdfSectionEditorProps {
    sections: PdfSection[]
    onChange: (sections: PdfSection[]) => void
    primaryColor: string
}

export function PdfSectionEditor({ sections, onChange, primaryColor }: PdfSectionEditorProps) {
    const {
        expandedSection,
        setExpandedSection,
        draggedId,
        dragOverId,
        dropPlacement,
        hoveredHandleId,
        setHoveredHandleId,
        addSection,
        removeSection,
        moveSection,
        updateSection,
        updateStyle,
        handleImageUpload,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleContainerDrop,
        handleDragEnd,
    } = usePdfSectionEditor({ sections, onChange, primaryColor })

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
                {sections.map((section, index) => (
                    <SectionCard
                        key={section.id}
                        section={section}
                        index={index}
                        totalSections={sections.length}
                        isExpanded={expandedSection === section.id}
                        isDragging={draggedId === section.id}
                        isDragOver={dragOverId === section.id}
                        dropPlacement={dragOverId === section.id ? dropPlacement : null}
                        primaryColor={primaryColor}
                        onExpand={setExpandedSection}
                        onMove={moveSection}
                        onRemove={removeSection}
                        onHoverHandle={setHoveredHandleId}
                        updateSection={updateSection}
                        updateStyle={updateStyle}
                        handleImageUpload={handleImageUpload}
                        draggable={hoveredHandleId === section.id}
                        onDragStart={(e) => handleDragStart(e, section.id)}
                        onDragOver={(e) => handleDragOver(e, section.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, section.id)}
                        onDragEnd={handleDragEnd}
                    />
                ))}
            </div>

            {/* Add Section Buttons */}
            <AddSectionButtons onAddSection={addSection} />
        </div>
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
