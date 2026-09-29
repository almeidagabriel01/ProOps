import React from "react";

interface CotaProps {
  /** Início e fim da linha de cota, em unidades do SVG. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  rotulo: string;
  /** Cota fora de foco no modo atual (ex.: altura no preço por largura). */
  apagada?: boolean;
}

/**
 * A linha de cota do desenho técnico: traço fino com os dois batentes e a
 * medida escrita no meio. A medida é texto de verdade (e em fonte tabular),
 * porque é o número que a pessoa acabou de arrastar.
 */
export function Cota({ x1, y1, x2, y2, rotulo, apagada }: CotaProps) {
  const vertical = x1 === x2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const batente = 6;
  return (
    <g
      className={vertical ? "cena-cota cena-cota-v" : "cena-cota"}
      opacity={apagada ? 0.3 : 1}
      stroke="currentColor"
      fill="currentColor"
      style={{ transition: "opacity 0.3s ease" }}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1.2} />
      {vertical ? (
        <>
          <line x1={x1 - batente} y1={y1} x2={x1 + batente} y2={y1} strokeWidth={1.2} />
          <line x1={x2 - batente} y1={y2} x2={x2 + batente} y2={y2} strokeWidth={1.2} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - batente} x2={x1} y2={y1 + batente} strokeWidth={1.2} />
          <line x1={x2} y1={y2 - batente} x2={x2} y2={y2 + batente} strokeWidth={1.2} />
        </>
      )}
      <text
        x={vertical ? mx - 10 : mx}
        y={vertical ? my : my - 8}
        textAnchor="middle"
        dominantBaseline={vertical ? "middle" : "auto"}
        transform={vertical ? `rotate(-90 ${mx - 10} ${my})` : undefined}
        stroke="none"
        className="text-[11px] font-semibold tabular-nums"
      >
        {rotulo}
      </text>
    </g>
  );
}
