import { describe, expect, it } from "vitest";

import { clampToViewport, DRAG_MARGIN } from "../use-draggable-position";

const CARD = { width: 360, height: 400 };
const VIEWPORT = { width: 1280, height: 720 };

describe("clampToViewport", () => {
  it("mantém uma posição que já cabe", () => {
    expect(clampToViewport({ x: 200, y: 100 }, CARD, VIEWPORT)).toEqual({ x: 200, y: 100 });
  });

  it("puxa de volta o card arrastado para fora pela direita e por baixo", () => {
    expect(clampToViewport({ x: 5000, y: 5000 }, CARD, VIEWPORT)).toEqual({
      x: VIEWPORT.width - CARD.width - DRAG_MARGIN,
      y: VIEWPORT.height - CARD.height - DRAG_MARGIN,
    });
  });

  it("puxa de volta o card arrastado para fora pela esquerda e por cima", () => {
    expect(clampToViewport({ x: -300, y: -50 }, CARD, VIEWPORT)).toEqual({
      x: DRAG_MARGIN,
      y: DRAG_MARGIN,
    });
  });

  it("card maior que a janela cola no topo, onde ficam título e controles", () => {
    expect(
      clampToViewport({ x: 100, y: 300 }, { width: 360, height: 900 }, VIEWPORT).y,
    ).toBe(DRAG_MARGIN);
  });
});
