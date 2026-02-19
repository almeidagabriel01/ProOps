interface PdfExtraBadgeProps {
  className?: string;
}

export function PdfExtraBadge({ className = "" }: PdfExtraBadgeProps) {
  const text = "EXTRA";
  const height = 20;
  const fontSize = 10;
  const horizontalPadding = 8;
  const radius = Math.round(height / 2);
  const estimatedTextWidth = Math.ceil(text.length * fontSize * 0.62);
  const width = estimatedTextWidth + horizontalPadding * 2;
  const textY = Number((height / 2 + fontSize * 0.36).toFixed(2));

  return (
    <span
      data-pdf-item-extra-tag="1"
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
          fill="#dbeafe"
          stroke="#bfdbfe"
        />
        <text
          x={width / 2}
          y={textY}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill="#1d4ed8"
          fontFamily="Arial, sans-serif"
        >
          {text}
        </text>
      </svg>
    </span>
  );
}
