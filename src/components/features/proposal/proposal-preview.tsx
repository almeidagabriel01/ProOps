"use client"

import * as React from "react"
import { ProposalSection, CustomFieldType, CustomFieldItem } from "@/types"
import { Proposal } from "@/services/proposal-service"
import { CustomFieldService } from "@/services/custom-field-service"
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
                <div className="space-y-8">
                    {sections.map((section, index) => (
                        <PreviewSection 
                            key={index} 
                            section={section} 
                            primaryColor={tenant?.primaryColor} 
                            proposal={proposal} 
                        />
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
    proposal: Partial<Proposal>
}

const PreviewSection = ({ section, primaryColor, proposal }: PreviewSectionProps) => {
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
        case "product-table": {
            const products = proposal?.products || []
            const sistemas = proposal?.sistemas || []
            const hasSistemas = sistemas.length > 0
            
            if (products.length === 0) return <div className="text-gray-500 italic text-center py-4">Nenhum produto selecionado</div>

            const renderProductTable = (items: any[], title?: string, sistemaInfo?: any) => {
                 const total = items.reduce((sum, item) => sum + (item.total || (item.quantity * item.unitPrice)), 0)
                 return (
                    <div className="mb-6">
                        {sistemaInfo ? (
                             <div className="flex items-center gap-3 p-3 rounded-t-lg border-x border-t" style={{ borderColor: color, backgroundColor: `${color}10` }}>
                                <div className="font-bold text-lg" style={{ color: color }}>{sistemaInfo.sistemaName}</div>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white border" style={{ borderColor: color, color: color }}>{sistemaInfo.ambienteName}</span>
                             </div>
                        ) : title ? (
                             <div className="flex items-center gap-3 p-3 rounded-t-lg border-x border-t bg-gray-50 border-gray-200">
                                <div className="font-bold text-lg text-gray-700">{title}</div>
                             </div>
                        ) : null}
                        
                        <table className="w-full border-collapse">
                            <thead>
                                <tr style={{ backgroundColor: color }} className="text-white">
                                    <th className="text-left px-3 py-2 font-medium first:rounded-tl-none">Item</th>
                                    <th className="text-center px-3 py-2 font-medium w-20">Qtd</th>
                                    <th className="text-right px-3 py-2 font-medium w-28">Preço Unit.</th>
                                    <th className="text-right px-3 py-2 font-medium w-28 last:rounded-tr-none">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={item.productId || i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                                        <td className="px-3 py-2 border-b border-gray-200">{item.productName || item.name}</td>
                                        <td className="px-3 py-2 border-b border-gray-200 text-center">{item.quantity}</td>
                                        <td className="px-3 py-2 border-b border-gray-200 text-right">
                                            R$ {(item.unitPrice || 0).toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 border-b border-gray-200 text-right font-medium">
                                            R$ {(item.total || (item.quantity * item.unitPrice)).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: `${color}10` }}>
                                    <td colSpan={3} className="px-3 py-2 text-right font-semibold" style={{ color: color }}>
                                        Subtotal
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-lg" style={{ color: color }}>
                                        R$ {total.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                 )
            }

            if (hasSistemas) {
                const sistemaProductIds = new Set(sistemas.flatMap((s: any) => s.productIds || []))
                const extraProducts = products.filter((p: any) => !p.systemInstanceId && !sistemaProductIds.has(p.productId))

                return (
                    <div>
                        {section.title && <h2 className="text-xl font-bold mb-4 pb-2 border-b-2" style={{ borderColor: color, color: color }}>{section.title}</h2>}
                        
                        {sistemas.map((sistema: any) => {
                             const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
                             let sistemaProducts = products.filter((p: any) => p.systemInstanceId === systemInstanceId);
                             
                             // Fallback for legacy proposals (only if no products have instance IDs)
                             const isLegacy = !products.some((p: any) => p.systemInstanceId);
                             if (sistemaProducts.length === 0 && isLegacy) {
                                sistemaProducts = products.filter((p: any) => sistema.productIds?.includes(p.productId));
                             }

                             if (sistemaProducts.length === 0) return null
                             return <React.Fragment key={`${sistema.sistemaId}-${sistema.ambienteId}`}>{renderProductTable(sistemaProducts, undefined, sistema)}</React.Fragment>
                        })}

                        {extraProducts.length > 0 && renderProductTable(extraProducts, "Produtos Extras")}
                    </div>
                )
            } else {
                return (
                     <div>
                        {section.title && <h2 className="text-xl font-bold mb-4 pb-2 border-b-2" style={{ borderColor: color, color: color }}>{section.title}</h2>}
                        {renderProductTable(products)}
                     </div>
                )
            }
        }

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

        case "custom-field":
            return <CustomFieldBlock section={section} />

        case "hierarchical-field":
            return <HierarchicalFieldBlock section={section} primaryColor={color} />

        default:
            return null
    }
}



// Helper Components for Async Data
const CustomFieldBlock = ({ section }: { section: ProposalSection }) => {
    const [fieldType, setFieldType] = React.useState<CustomFieldType | null>(null)
    const content = parseContent(section.content)

    React.useEffect(() => {
        const load = async () => {
            if (typeof content.fieldTypeId === 'string') {
                const type = await CustomFieldService.getCustomFieldTypeById(content.fieldTypeId)
                setFieldType(type)
            }
        }
        load()
    }, [content.fieldTypeId])

    if (!fieldType) return null

    // items selected
    const selectedItemIds = (content.selectedItems as string[]) || []
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

const HierarchicalFieldBlock = ({ section, primaryColor }: { section: ProposalSection, primaryColor?: string }) => {
    const [envType, setEnvType] = React.useState<CustomFieldType | null>(null)
    const [sysType, setSysType] = React.useState<CustomFieldType | null>(null)
    const content = parseContent(section.content)

    React.useEffect(() => {
        const load = async () => {
            if (typeof content.environmentTypeId === 'string') {
                const e = await CustomFieldService.getCustomFieldTypeById(content.environmentTypeId)
                setEnvType(e)
            }
            if (typeof content.systemTypeId === 'string') {
                const s = await CustomFieldService.getCustomFieldTypeById(content.systemTypeId)
                setSysType(s)
            }
        }
        load()
    }, [content.environmentTypeId, content.systemTypeId])

    if (!envType || !sysType) return null

    const entries = (content.entries as { id: string; environmentItemId: string; systemItems: string[] }[]) || []
    if (entries.length === 0) return null

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
                    <div key={entry.id} className="border rounded-lg overflow-hidden" style={{ borderColor: primaryColor || "#333" }}>
                        {/* Environment Header */}
                        <div
                            className="flex items-center gap-3 p-3 text-white"
                            style={{ backgroundColor: primaryColor || "#333" }}
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
