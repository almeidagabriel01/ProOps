"use client"

import * as React from "react"
import { Proposal } from "@/lib/mock-db"
import { useTenant } from "@/providers/tenant-provider"

interface PdfCoverPageProps {
    proposal: Partial<Proposal>
    theme?: 'modern' | 'classic' | 'minimal'
    showDate?: boolean
}

export function PdfCoverPage({ proposal, theme = 'modern', showDate = true }: PdfCoverPageProps) {
    const { tenant } = useTenant()
    const primaryColor = tenant?.primaryColor || "#2563eb"

    const formatDate = (dateString?: string) => {
        if (!dateString) return ""
        return new Date(dateString).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        })
    }

    // Generate gradient based on primary color
    const getGradient = () => {
        return `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`
    }

    // Lighten or darken a hex color
    const adjustColor = (hex: string, percent: number) => {
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

    if (theme === 'minimal') {
        return (
            <div className="h-[297mm] w-full flex flex-col justify-center items-center p-12 bg-white">
                {tenant?.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tenant.logoUrl} alt="" className="h-20 object-contain mb-8" />
                )}
                <div className="text-center">
                    <div
                        className="text-6xl font-light tracking-tight mb-4"
                        style={{ color: primaryColor }}
                    >
                        Proposta Comercial
                    </div>
                    {proposal.title && (
                        <div className="text-3xl text-gray-800 font-semibold mb-8">
                            {proposal.title}
                        </div>
                    )}
                    <div className="w-24 h-1 mx-auto mb-8" style={{ backgroundColor: primaryColor }} />
                    {proposal.clientName && (
                        <div className="text-xl text-gray-600">
                            Preparada para: <span className="font-semibold text-gray-800">{proposal.clientName}</span>
                        </div>
                    )}
                </div>
                {showDate && (
                    <div className="absolute bottom-12 text-gray-500 text-sm">
                        {formatDate(new Date().toISOString())}
                    </div>
                )}
            </div>
        )
    }

    if (theme === 'classic') {
        return (
            <div className="h-[297mm] w-full flex flex-col bg-white">
                {/* Header Bar */}
                <div className="h-2" style={{ backgroundColor: primaryColor }} />

                <div className="flex-1 flex flex-col justify-center items-center p-12">
                    {tenant?.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tenant.logoUrl} alt="" className="h-24 object-contain mb-12" />
                    )}

                    <div className="border-t-2 border-b-2 py-8 px-12" style={{ borderColor: primaryColor }}>
                        <div className="text-center">
                            <div className="text-lg uppercase tracking-[0.3em] text-gray-500 mb-4">
                                Proposta Comercial
                            </div>
                            {proposal.title && (
                                <div className="text-4xl font-serif font-bold text-gray-900 mb-2">
                                    {proposal.title}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-12 text-center">
                        {proposal.clientName && (
                            <div className="text-lg text-gray-600 mb-2">
                                Apresentada a
                            </div>
                        )}
                        {proposal.clientName && (
                            <div className="text-2xl font-semibold text-gray-900">
                                {proposal.clientName}
                            </div>
                        )}
                        {proposal.clientEmail && (
                            <div className="text-gray-500 mt-1">{proposal.clientEmail}</div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t flex justify-between items-center text-sm text-gray-500">
                    <div>{tenant?.name}</div>
                    <div>{showDate && formatDate(new Date().toISOString())}</div>
                </div>
            </div>
        )
    }

    // Modern theme (default)
    return (
        <div className="h-[297mm] w-full flex flex-col overflow-hidden relative">
            {/* Gradient Background */}
            <div
                className="absolute inset-0"
                style={{ background: getGradient() }}
            />

            {/* Decorative circles */}
            <div
                className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
                style={{ backgroundColor: 'white' }}
            />
            <div
                className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full opacity-10"
                style={{ backgroundColor: 'white' }}
            />

            {/* Content */}
            <div className="relative z-10 flex-1 flex flex-col justify-between p-12 text-white">
                {/* Top - Logo */}
                <div>
                    {tenant?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={tenant.logoUrl}
                            alt=""
                            className="h-16 object-contain brightness-0 invert"
                        />
                    ) : (
                        <div className="text-2xl font-bold">{tenant?.name}</div>
                    )}
                </div>

                {/* Center - Main Content */}
                <div className="my-auto">
                    <div className="text-lg uppercase tracking-[0.2em] opacity-80 mb-4">
                        Proposta Comercial
                    </div>
                    {proposal.title && (
                        <div className="text-5xl font-bold leading-tight mb-6">
                            {proposal.title}
                        </div>
                    )}
                    <div className="w-24 h-1 bg-white opacity-60 mb-8" />
                    {proposal.clientName && (
                        <div className="text-xl opacity-90">
                            Preparada especialmente para <br />
                            <span className="text-2xl font-semibold">{proposal.clientName}</span>
                        </div>
                    )}
                </div>

                {/* Bottom - Meta */}
                <div className="flex justify-between items-end opacity-80">
                    {showDate && (
                        <div className="text-sm">
                            {formatDate(new Date().toISOString())}
                        </div>
                    )}
                    {proposal.validUntil && (
                        <div className="text-sm text-right">
                            Válida até<br />
                            <span className="font-semibold">{formatDate(proposal.validUntil)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
