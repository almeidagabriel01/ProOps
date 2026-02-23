import React from "react";

interface PdfStatusBadgeProps {
  status: "paid" | "pending" | "overdue";
}

export function PdfStatusBadge({ status }: PdfStatusBadgeProps) {
  let text = "Pendente";
  let bgFill = "#fef3c7";
  let textFill = "#b45309";
  let stroke = "#fde68a";

  if (status === "paid") {
    text = "Pago";
    bgFill = "#dcfce7";
    textFill = "#15803d";
    stroke = "#bbf7d0";
  } else if (status === "overdue") {
    text = "Atrasado";
    bgFill = "#fee2e2";
    textFill = "#b91c1c";
    stroke = "#fecaca";
  }

  const height = 20;
  const fontSize = 10;
  const horizontalPadding = 8;
  const radius = Math.round(height / 2);
  const estimatedTextWidth = Math.ceil(text.length * fontSize * 0.65);
  const width = estimatedTextWidth + horizontalPadding * 2;
  const textY = Number((height / 2 + fontSize * 0.36).toFixed(2));

  return (
    <span
      data-pdf-item-status-tag="1"
      style={{
        display: "inline-block",
        width: `${width}px`,
        height: `${height}px`,
        lineHeight: "0",
        boxSizing: "border-box",
        verticalAlign: "middle",
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
          fill={bgFill}
          stroke={stroke}
        />
        <text
          x={width / 2}
          y={textY}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill={textFill}
          fontFamily="Arial, sans-serif"
        >
          {text}
        </text>
      </svg>
    </span>
  );
}
