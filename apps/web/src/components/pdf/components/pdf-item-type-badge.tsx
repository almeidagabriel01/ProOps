interface PdfItemTypeBadgeProps {
  itemType?: "product" | "service";
  className?: string;
}

export function PdfItemTypeBadge({
  itemType = "product",
  className = "",
}: PdfItemTypeBadgeProps) {
  const isService = itemType === "service";
  const text = isService ? "SERVIÇO" : "PRODUTO";
  const height = 18;
  const fontSize = 9;
  const width = 66;
  const radius = Math.round(height / 2);
  const textY = Number((height / 2 + fontSize * 0.36).toFixed(2));

  const fill = isService ? "#fdf2f8" : "#ecfdf5";
  const stroke = isService ? "#f9a8d4" : "#86efac";
  const textColor = isService ? "#9f1239" : "#166534";

  return (
    <span
      data-pdf-item-type-tag={isService ? "service" : "product"}
      className={className}
      style={{
        display: "block",
        width: `${width}px`,
        height: `${height}px`,
        lineHeight: "0",
        boxSizing: "border-box",
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", width: `${width}px`, height: `${height}px` }}
      >
        <rect
          x="0.5"
          y="0.5"
          width={width - 1}
          height={height - 1}
          rx={radius}
          ry={radius}
          fill={fill}
          stroke={stroke}
        />
        <text
          x={width / 2}
          y={textY}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill={textColor}
          fontFamily="Arial, sans-serif"
        >
          {text}
        </text>
      </svg>
    </span>
  );
}
