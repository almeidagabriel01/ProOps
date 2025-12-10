"use client"

import * as React from "react"
import { ProposalSection, Proposal, MockDB, CustomFieldType, CustomFieldItem } from "@/lib/mock-db"
import { useTenant } from "@/providers/tenant-provider"

interface ProposalPreviewProps {
    proposal: Partial<Proposal>
    sections: ProposalSection[]
}

export function ProposalPreview({ proposal, sections }: ProposalPreviewProps) {
    const { tenant } = useTenant()

    const formatDate = (dateString?: string) => {
        if (!dateString) return ""
        return new Date(dateString).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        })
    }

    return (
        <div className="bg-white text-gray-900 rounded-lg shadow-lg overflow-hidden">
            {/* A4-like document wrapper */}
            <div className="p-8 min-h-[800px] space-y-6" style={{ fontFamily: "Georgia, serif" }}>
                {/* Header */}
                <div className="flex items-start justify-between border-b pb-6" style={{ borderColor: tenant?.primaryColor || "#333" }}>
                    <div>
                        {tenant?.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tenant.logoUrl} alt={tenant.name} className="h-12 object-contain" />
                        ) : (
                            <div
                                className="text-2xl font-bold"
                                style={{ color: tenant?.primaryColor || "#333" }}
                            >
                                {tenant?.name || "Empresa"}
                            </div>
                        )}
                    </div>
                    <div className="text-right text-sm text-gray-600">
                        <div className="font-semibold text-lg text-gray-900">PROPOSTA COMERCIAL</div>
                        <div>Data: {formatDate(new Date().toISOString())}</div>
                        {proposal.validUntil && (
                            <div>Válida até: {formatDate(proposal.validUntil)}</div>
                        )}
                    </div>
                </div>

                {/* Title */}
                {proposal.title && (
                    <div className="text-center py-4">
                        <h1 className="text-2xl font-bold" style={{ color: tenant?.primaryColor || "#333" }}>
                            {proposal.title}
                        </h1>
                    </div>
                )}

                {/* Client Info */}
                {proposal.clientName && (
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Cliente
                        </div>
                        <div className="font-semibold text-lg">{proposal.clientName}</div>
                        {proposal.clientEmail && (
                            <div className="text-sm text-gray-600">{proposal.clientEmail}</div>
                        )}
                        {proposal.clientPhone && (
                            <div className="text-sm text-gray-600">{proposal.clientPhone}</div>
                        )}
                    </div>
                )}

                {/* Sections */}
                <div className="space-y-6">
                    {sections.map((section) => (
                        <PreviewSection key={section.id} section={section} primaryColor={tenant?.primaryColor} />
                    ))}
                </div>

                {/* Footer */}
                <div className="border-t pt-6 mt-8 text-center text-sm text-gray-500">
                    <p>Esta proposta é válida por 30 dias a partir da data de emissão.</p>
                    <p className="mt-2 font-semibold" style={{ color: tenant?.primaryColor || "#333" }}>
                        {tenant?.name || "Empresa"}
                    </p>
                </div>
            </div>
        </div>
    )
}

interface PreviewSectionProps {
    section: ProposalSection
    primaryColor?: string
}

function PreviewSection({ section, primaryColor }: PreviewSectionProps) {
    const content = parseContent(section.content)
    const color = primaryColor || "#333"
    const textStyle = section.textStyle || {}
    const imageStyle = section.imageStyle || {}

    // Helper to get text style object
    const getTextStyleObj = () => ({
        color: textStyle.color || undefined,
        fontSize: textStyle.fontSize ? `${textStyle.fontSize}px` : undefined,
        fontWeight: textStyle.fontWeight || undefined,
        fontStyle: textStyle.fontStyle || undefined,
        textAlign: textStyle.textAlign || undefined,
        textDecoration: textStyle.textDecoration || undefined
    })

    switch (section.type) {
        case "header":
            return (
                <div>
                    <h2
                        className="text-xl font-bold pb-2 border-b-2"
                        style={{
                            borderColor: textStyle.color || color,
                            ...getTextStyleObj(),
                            color: textStyle.color || color
                        }}
                    >
                        {(content.text as string) || section.title}
                    </h2>
                </div>
            )

        case "text":
            return (
                <div>
                    {section.title && (
                        <h3 className="font-semibold text-gray-800 mb-2">{section.title}</h3>
                    )}
                    <p
                        className="text-gray-700 whitespace-pre-wrap leading-relaxed"
                        style={getTextStyleObj()}
                    >
                        {(content.text as string) || ""}
                    </p>
                </div>
            )

        case "image": {
            const imageData = (content.data as string) || (content.url as string)
            const caption = content.caption as string | undefined
            if (!imageData) return null

            const alignClass = {
                left: 'text-left',
                center: 'text-center',
                right: 'text-right'
            }[imageStyle.align || 'center']

            return (
                <div className={alignClass}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imageData}
                        alt={caption || "Imagem"}
                        className="inline-block"
                        style={{
                            width: imageStyle.width ? `${imageStyle.width}%` : 'auto',
                            maxWidth: '100%',
                            borderRadius: imageStyle.borderRadius || 0,
                            boxShadow: imageStyle.shadow ? '0 4px 12px rgba(0,0,0,0.15)' : undefined
                        }}
                    />
                    {caption && (
                        <p className="text-sm text-gray-500 mt-2 italic">{caption}</p>
                    )}
                </div>
            )
        }

        case "list": {
            const items = (content.items as string[]) || []
            if (items.length === 0) return null
            return (
                <div>
                    {section.title && (
                        <h3 className="font-semibold text-gray-800 mb-2">{section.title}</h3>
                    )}
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {items.map((item, i) => item && (
                            <li key={i}>{item}</li>
                        ))}
                    </ul>
                </div>
            )
        }

        case "table":
            const tableItems = (content.items as TableItem[]) || []
            const showTotal = content.showTotal !== false
            if (tableItems.length === 0) return null

            const total = tableItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

            return (
                <div>
                    {section.title && (
                        <h3 className="font-semibold text-gray-800 mb-3">{section.title}</h3>
                    )}
                    <table className="w-full border-collapse">
                        <thead>
                            <tr style={{ backgroundColor: color }} className="text-white">
                                <th className="text-left px-3 py-2 font-medium">Item</th>
                                <th className="text-center px-3 py-2 font-medium w-20">Qtd</th>
                                <th className="text-right px-3 py-2 font-medium w-28">Preço Unit.</th>
                                <th className="text-right px-3 py-2 font-medium w-28">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableItems.map((item, i) => (
                                <tr key={item.id || i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                                    <td className="px-3 py-2 border-b border-gray-200">{item.name}</td>
                                    <td className="px-3 py-2 border-b border-gray-200 text-center">{item.quantity}</td>
                                    <td className="px-3 py-2 border-b border-gray-200 text-right">
                                        R$ {item.unitPrice.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 border-b border-gray-200 text-right font-medium">
                                        R$ {(item.quantity * item.unitPrice).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {showTotal && (
                            <tfoot>
                                <tr style={{ backgroundColor: color }} className="text-white">
                                    <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                                        Total
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-lg">
                                        R$ {total.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )

        case "separator":
            return <hr className="border-gray-300 my-4" />

        case "custom-field": {
            const fieldTypeId = content.fieldTypeId as string | undefined
            const selectedItemIds = (content.selectedItems as string[]) || []
            if (!fieldTypeId) return null

            const fieldType = MockDB.getCustomFieldTypeById(fieldTypeId)
            if (!fieldType) return null

            const selectedItems = fieldType.items.filter(i => selectedItemIds.includes(i.id))
            if (selectedItems.length === 0) return null

            return (
                <div>
                    {section.title && (
                        <h3 className="font-semibold text-gray-800 mb-3">{section.title}</h3>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedItems.map(item => (
                            <div key={item.id} className="text-center">
                                {item.image && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.image}
                                        alt={item.label}
                                        className="w-full h-20 object-cover rounded-lg mb-1"
                                    />
                                )}
                                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        case "hierarchical-field": {
            const environmentTypeId = content.environmentTypeId as string | undefined
            const systemTypeId = content.systemTypeId as string | undefined
            const entries = (content.entries as { id: string; environmentItemId: string; systemItems: string[] }[]) || []

            if (!environmentTypeId || !systemTypeId || entries.length === 0) return null

            const envType = MockDB.getCustomFieldTypeById(environmentTypeId)
            const sysType = MockDB.getCustomFieldTypeById(systemTypeId)
            if (!envType || !sysType) return null

            return (
                <div className="space-y-4">
                    {section.title && (
                        <h3 className="font-semibold text-gray-800 mb-3">{section.title}</h3>
                    )}
                    {entries.map(entry => {
                        const envItem = envType.items.find(i => i.id === entry.environmentItemId)
                        if (!envItem) return null

                        const systemItems = sysType.items.filter(i => entry.systemItems.includes(i.id))
                        if (systemItems.length === 0) return null

                        return (
                            <div key={entry.id} className="border rounded-lg overflow-hidden" style={{ borderColor: color }}>
                                {/* Environment Header */}
                                <div
                                    className="flex items-center gap-3 p-3 text-white"
                                    style={{ backgroundColor: color }}
                                >
                                    {envItem.image && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={envItem.image}
                                            alt={envItem.label}
                                            className="w-10 h-10 rounded object-cover"
                                        />
                                    )}
                                    <span className="font-semibold">{envItem.label}</span>
                                </div>
                                {/* System Items */}
                                <div className="p-3 bg-gray-50">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {systemItems.map(item => (
                                            <div key={item.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                                                {item.image && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={item.image}
                                                        alt={item.label}
                                                        className="w-8 h-8 rounded object-cover"
                                                    />
                                                )}
                                                <span className="text-xs font-medium">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )
        }

        default:
            return null
    }
}

interface TableItem {
    id: string
    name: string
    quantity: number
    unitPrice: number
}

function parseContent(content: string): Record<string, unknown> {
    try {
        return JSON.parse(content)
    } catch {
        return {}
    }
}
