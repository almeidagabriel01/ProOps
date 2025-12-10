"use client"

import * as React from "react"
import { Proposal, ProposalTemplate, MockDB } from "@/lib/mock-db"
import { useTenant } from "@/providers/tenant-provider"

interface TemplatePreviewProps {
    proposal: Partial<Proposal>
    template?: ProposalTemplate | null
}

export function TemplatePreview({ proposal, template }: TemplatePreviewProps) {
    const { tenant } = useTenant()

    const primaryColor = template?.primaryColor || tenant?.primaryColor || "#2563eb"
    const fontFamily = template?.fontFamily || "'Inter', sans-serif"
    const products = proposal.products || []

    const formatDate = (dateString?: string) => {
        if (!dateString) return ""
        return new Date(dateString).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        })
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    const subtotal = products.reduce((sum, p) => sum + p.total, 0)
    const discountAmount = (subtotal * (proposal.discount || 0)) / 100
    const total = subtotal - discountAmount

    // Parse template text with line breaks
    const renderText = (text?: string) => {
        if (!text) return null
        return text.split('\n').map((line, i) => (
            <React.Fragment key={i}>
                {line}
                {i < text.split('\n').length - 1 && <br />}
            </React.Fragment>
        ))
    }

    return (
        <div
            className="bg-white text-gray-900 shadow-lg"
            style={{ fontFamily }}
        >
            {/* Cover Page */}
            <div
                className="min-h-[297mm] p-12 flex flex-col relative overflow-hidden"
                style={{
                    background: template?.theme === 'modern'
                        ? `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`
                        : 'white'
                }}
            >
                {template?.theme === 'modern' ? (
                    // Modern Theme Cover
                    <>
                        <div
                            className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
                            style={{ backgroundColor: 'white' }}
                        />
                        <div
                            className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full opacity-10"
                            style={{ backgroundColor: 'white' }}
                        />
                        <div className="relative z-10 flex-1 flex flex-col justify-between text-white">
                            <div>
                                {tenant?.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={tenant.logoUrl}
                                        alt={tenant.name}
                                        className="h-16 object-contain brightness-0 invert"
                                    />
                                ) : (
                                    <div className="text-2xl font-bold">{tenant?.name}</div>
                                )}
                            </div>
                            <div className="my-auto">
                                <div className="text-lg uppercase tracking-[0.2em] opacity-80 mb-4">
                                    Proposta Comercial
                                </div>
                                <div className="text-5xl font-bold leading-tight mb-6">
                                    {proposal.title || "Proposta"}
                                </div>
                                <div className="w-24 h-1 bg-white/60 mb-8" />
                                <div className="text-xl opacity-90">
                                    Preparada para<br />
                                    <span className="text-2xl font-semibold">{proposal.clientName}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-end opacity-80 text-sm">
                                <div>{formatDate(new Date().toISOString())}</div>
                                {proposal.validUntil && (
                                    <div className="text-right">
                                        Válida até<br />
                                        <span className="font-semibold">{formatDate(proposal.validUntil)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : template?.theme === 'classic' ? (
                    // Classic Theme Cover
                    <div className="flex flex-col h-full">
                        <div className="h-2 w-full mb-8" style={{ backgroundColor: primaryColor }} />
                        <div className="flex-1 flex flex-col justify-center items-center text-center">
                            {tenant?.logoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={tenant.logoUrl} alt="" className="h-24 object-contain mb-12" />
                            )}
                            <div className="border-t-2 border-b-2 py-8 px-12" style={{ borderColor: primaryColor }}>
                                <div className="text-lg uppercase tracking-[0.3em] text-gray-500 mb-4">
                                    Proposta Comercial
                                </div>
                                <div className="text-4xl font-serif font-bold text-gray-900">
                                    {proposal.title}
                                </div>
                            </div>
                            <div className="mt-12">
                                <div className="text-lg text-gray-600 mb-2">Apresentada a</div>
                                <div className="text-2xl font-semibold text-gray-900">
                                    {proposal.clientName}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                            <div>{tenant?.name}</div>
                            <div>{formatDate(new Date().toISOString())}</div>
                        </div>
                    </div>
                ) : template?.theme === 'tech' ? (
                    // Tech Theme Cover - Dark & Futuristic
                    <div
                        className="flex flex-col h-full relative overflow-hidden"
                        style={{ background: `linear-gradient(180deg, #0a0a0a 0%, ${primaryColor}20 100%)` }}
                    >
                        {/* Grid Pattern */}
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute inset-0" style={{
                                backgroundImage: `linear-gradient(${primaryColor}20 1px, transparent 1px), linear-gradient(90deg, ${primaryColor}20 1px, transparent 1px)`,
                                backgroundSize: '40px 40px'
                            }} />
                        </div>
                        {/* Glow Effect */}
                        <div
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-30"
                            style={{ backgroundColor: primaryColor }}
                        />
                        <div className="relative z-10 flex-1 flex flex-col p-12 text-white">
                            <div className="flex items-center gap-3">
                                {tenant?.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={tenant.logoUrl} alt="" className="h-10 object-contain brightness-0 invert" />
                                ) : (
                                    <div className="text-xl font-bold">{tenant?.name}</div>
                                )}
                                <div className="flex-1 h-px" style={{ backgroundColor: primaryColor }} />
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-sm uppercase tracking-[0.3em] opacity-60 mb-4" style={{ color: primaryColor }}>
                                    Proposta Comercial
                                </div>
                                <div className="text-5xl font-bold mb-4">{proposal.title}</div>
                                <div className="text-lg opacity-70">Preparada para {proposal.clientName}</div>
                            </div>
                            <div className="flex justify-between text-sm opacity-60">
                                <span>{formatDate(new Date().toISOString())}</span>
                                {proposal.validUntil && <span>Válida até {formatDate(proposal.validUntil)}</span>}
                            </div>
                        </div>
                    </div>
                ) : template?.theme === 'elegant' ? (
                    // Elegant Theme Cover - Premium Gold
                    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
                        {/* Gold Border */}
                        <div className="absolute inset-8 border-2 rounded-lg" style={{ borderColor: '#D4AF37' }} />
                        <div className="absolute inset-10 border rounded-lg" style={{ borderColor: '#D4AF3750' }} />
                        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-16 text-white">
                            {tenant?.logoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={tenant.logoUrl} alt="" className="h-16 object-contain brightness-0 invert mb-8" />
                            )}
                            <div className="w-24 h-0.5 mb-6" style={{ backgroundColor: '#D4AF37' }} />
                            <div className="text-sm uppercase tracking-[0.4em] mb-4" style={{ color: '#D4AF37' }}>
                                Proposta Comercial
                            </div>
                            <div className="text-4xl font-serif font-bold mb-6" style={{ color: '#D4AF37' }}>
                                {proposal.title}
                            </div>
                            <div className="w-16 h-0.5 mb-6" style={{ backgroundColor: '#D4AF37' }} />
                            <div className="text-lg opacity-80">
                                Exclusivamente para<br />
                                <span className="text-xl font-semibold" style={{ color: '#D4AF37' }}>{proposal.clientName}</span>
                            </div>
                        </div>
                        <div className="absolute bottom-8 left-0 right-0 text-center text-sm text-gray-400">
                            {formatDate(new Date().toISOString())}
                        </div>
                    </div>
                ) : template?.theme === 'bold' ? (
                    // Bold Theme Cover - Vibrant Geometric
                    <div className="flex flex-col h-full relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
                        {/* Geometric Shapes */}
                        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-black opacity-10" />
                        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-black opacity-10" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
                        <div className="absolute top-1/4 right-1/4 w-32 h-32 border-4 border-white opacity-20 rotate-45" />
                        <div className="relative z-10 flex-1 flex flex-col p-12 text-white">
                            <div>
                                {tenant?.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={tenant.logoUrl} alt="" className="h-14 object-contain brightness-0 invert" />
                                ) : (
                                    <div className="text-2xl font-black">{tenant?.name}</div>
                                )}
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-7xl font-black leading-none mb-4">{proposal.title}</div>
                                <div className="text-xl font-semibold opacity-90 border-l-4 border-white pl-4">
                                    {proposal.clientName}
                                </div>
                            </div>
                            <div className="text-sm font-semibold opacity-80">
                                {formatDate(new Date().toISOString())}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Minimal Theme Cover (default fallback)
                    <div className="flex flex-col h-full items-center justify-center text-center">
                        {tenant?.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tenant.logoUrl} alt="" className="h-20 object-contain mb-8" />
                        )}
                        <div
                            className="text-5xl font-light tracking-tight mb-4"
                            style={{ color: primaryColor }}
                        >
                            Proposta Comercial
                        </div>
                        <div className="text-2xl text-gray-800 font-semibold mb-8">
                            {proposal.title}
                        </div>
                        <div className="w-24 h-1 mx-auto mb-8" style={{ backgroundColor: primaryColor }} />
                        <div className="text-lg text-gray-600">
                            Para: <span className="font-semibold text-gray-800">{proposal.clientName}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Pages */}
            <div className="p-12 space-y-8">
                {/* Header */}
                <div className="flex items-start justify-between border-b-2 pb-6" style={{ borderColor: primaryColor }}>
                    <div>
                        {tenant?.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tenant.logoUrl} alt={tenant?.name} className="h-12 object-contain" />
                        ) : (
                            <div className="text-2xl font-bold" style={{ color: primaryColor }}>
                                {tenant?.name}
                            </div>
                        )}
                    </div>
                    <div className="text-right text-sm text-gray-600">
                        <div className="font-semibold text-lg text-gray-900">{proposal.title}</div>
                        <div>{proposal.clientName}</div>
                        {proposal.clientEmail && <div>{proposal.clientEmail}</div>}
                    </div>
                </div>

                {/* Introduction */}
                {template?.introductionText && (
                    <div className="leading-relaxed text-gray-700">
                        {renderText(template.introductionText)}
                    </div>
                )}

                {/* Scope */}
                {template?.scopeText && (
                    <div>
                        <h2
                            className="text-xl font-bold mb-4 pb-2 border-b-2"
                            style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                            Escopo do Projeto
                        </h2>
                        <p className="text-gray-700 leading-relaxed">
                            {renderText(template.scopeText)}
                        </p>
                    </div>
                )}

                {/* Products Table */}
                {products.length > 0 && (
                    <div>
                        <h2
                            className="text-xl font-bold mb-4 pb-2 border-b-2"
                            style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                            Produtos e Serviços
                        </h2>
                        <div className="space-y-4">
                            {products.map((product, i) => (
                                <div
                                    key={product.productId}
                                    className={`flex gap-4 p-4 rounded-lg ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} border`}
                                >
                                    {product.productImage && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={product.productImage}
                                            alt={product.productName}
                                            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{product.productName}</h4>
                                                {product.productDescription && (
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                        {product.productDescription}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-sm text-gray-500">
                                                    {product.quantity}x {formatCurrency(product.unitPrice)}
                                                </div>
                                                <div className="font-bold text-lg" style={{ color: primaryColor }}>
                                                    {formatCurrency(product.total)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Totals Summary */}
                        <div className="mt-6 border-t-2 pt-4" style={{ borderColor: primaryColor }}>
                            <div className="flex justify-end">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal:</span>
                                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                                    </div>
                                    {(proposal.discount || 0) > 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>Desconto ({proposal.discount}%):</span>
                                            <span className="font-medium">- {formatCurrency(discountAmount)}</span>
                                        </div>
                                    )}
                                    <div
                                        className="flex justify-between text-xl font-bold pt-2 border-t"
                                        style={{ borderColor: primaryColor }}
                                    >
                                        <span style={{ color: primaryColor }}>TOTAL:</span>
                                        <span style={{ color: primaryColor }}>{formatCurrency(total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Notes */}
                {proposal.customNotes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-800 mb-2">Observações</h3>
                        <p className="text-yellow-900 text-sm">{renderText(proposal.customNotes)}</p>
                    </div>
                )}

                {/* Payment Terms */}
                {template?.paymentTerms && (
                    <div>
                        <h2
                            className="text-xl font-bold mb-4 pb-2 border-b-2"
                            style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                            Condições de Pagamento
                        </h2>
                        <div className="text-gray-700 leading-relaxed">
                            {renderText(template.paymentTerms)}
                        </div>
                    </div>
                )}

                {/* Warranty */}
                {template?.warrantyText && (
                    <div>
                        <h2
                            className="text-xl font-bold mb-4 pb-2 border-b-2"
                            style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                            Garantia
                        </h2>
                        <p className="text-gray-700 leading-relaxed">
                            {renderText(template.warrantyText)}
                        </p>
                    </div>
                )}

                {/* Validity */}
                {proposal.validUntil && (
                    <div className="bg-gray-100 rounded-lg p-4 text-center">
                        <span className="text-gray-600">Esta proposta é válida até </span>
                        <span className="font-semibold">{formatDate(proposal.validUntil)}</span>
                    </div>
                )}

                {/* Footer */}
                {template?.footerText && (
                    <div className="mt-12 pt-8 border-t-2" style={{ borderColor: primaryColor }}>
                        <div className="text-gray-700 leading-relaxed">
                            {renderText(template.footerText)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// Helper function to adjust color brightness
function adjustColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) + amt
    const G = (num >> 8 & 0x00FF) + amt
    const B = (num & 0x0000FF) + amt
    return "#" + (
        0x1000000 +
        (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1)
}
