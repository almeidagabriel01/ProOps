import React from "react";

interface PdfPageHeaderProps {
    tenantName: string;
    coverTitle: string;
    clientName: string;
    contentStyles: Record<string, React.CSSProperties>;
}

/**
 * Renders the page header in PDF
 */
export function PdfPageHeader({ tenantName, coverTitle, clientName, contentStyles }: PdfPageHeaderProps) {
    return (
        <div
            className="flex items-start justify-between border-b-2 pb-6 mb-4"
            style={contentStyles.headerBorder}
        >
            <div className="text-2xl font-bold" style={contentStyles.headerTitle}>
                {tenantName}
            </div>
            <div className="text-right text-sm" style={contentStyles.headerSub}>
                <div className="font-semibold text-lg" style={{ color: "inherit" }}>
                    {coverTitle}
                </div>
                <div>{clientName}</div>
            </div>
        </div>
    );
}
