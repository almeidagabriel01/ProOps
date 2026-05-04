import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

interface PdfSectionRendererProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  section: any;
  primaryColor: string;
  contentStyles: Record<string, React.CSSProperties>;
}

/**
 * Renders a PDF section (text, image, divider, title)
 */
export function PdfSectionRenderer({
  section,
  primaryColor,
  contentStyles,
}: PdfSectionRendererProps) {
  return (
    <div
      style={{
        width: `${section.columnWidth || 100}%`,
        padding:
          section.columnWidth && section.columnWidth < 100
            ? "0 8px"
            : undefined,
        boxSizing: "border-box",
        marginTop: section.styles.marginTop,
        marginBottom: section.styles.marginBottom,
      }}
    >
      <div
        style={{
          fontSize: section.styles.fontSize,
          fontWeight: section.styles.fontWeight,
          fontStyle: section.styles.fontStyle,
          textAlign: section.styles.textAlign,
          color:
            section.styles.color ||
            (section.type === "title"
              ? contentStyles.headerTitle?.color || primaryColor
              : contentStyles.sectionText?.color),
          backgroundColor:
            section.styles.backgroundColor === "transparent"
              ? undefined
              : section.styles.backgroundColor,
          padding:
            section.styles.backgroundColor &&
            section.styles.backgroundColor !== "transparent"
              ? "12px"
              : undefined,
          borderRadius:
            section.styles.backgroundColor &&
            section.styles.backgroundColor !== "transparent"
              ? "8px"
              : undefined,
        }}
      >
        {section.type === "divider" ? (
          <hr style={{ borderTop: `2px solid ${primaryColor}` }} />
        ) : section.type === "image" ? (
          <div style={{ textAlign: section.styles.imageAlign || "center" }}>
            {section.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={section.imageUrl}
                alt=""
                style={{
                  width: `${section.styles.imageWidth || 100}%`,
                  maxWidth: "100%",
                  borderRadius: section.styles.imageBorderRadius || "8px",
                  border: section.styles.imageBorder
                    ? "3px solid #9ca3af"
                    : "none",
                  display: "inline-block",
                }}
              />
            )}
            {section.content && (
              <p className="text-sm text-gray-500 mt-2">{section.content}</p>
            )}
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            allowedElements={["p", "br", "strong", "em", "ul", "ol", "li"]}
            unwrapDisallowed
            components={{
              p: ({ children }) => <span>{children}</span>,
              ul: ({ children }) => (
                <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", margin: "0.25rem 0" }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ listStyle: "decimal", paddingLeft: "1.25rem", margin: "0.25rem 0" }}>{children}</ol>
              ),
              li: ({ children }) => <li style={{ margin: "0.125rem 0" }}>{children}</li>,
            }}
          >
            {section.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
