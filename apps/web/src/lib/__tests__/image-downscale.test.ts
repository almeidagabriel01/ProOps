import { describe, it, expect } from "vitest";
import { fitWithin } from "../image-downscale";

describe("fitWithin", () => {
  it("imagem pequena fica como esta", () => {
    expect(fitWithin(120, 80, 256)).toEqual({ width: 120, height: 80 });
  });
  it("reduz pelo maior lado mantendo a proporcao", () => {
    expect(fitWithin(2000, 1000, 256)).toEqual({ width: 256, height: 128 });
    expect(fitWithin(500, 1500, 256)).toEqual({ width: 85, height: 256 });
  });
  it("nunca chega a zero", () => {
    expect(fitWithin(10000, 1, 256)).toEqual({ width: 256, height: 1 });
  });
});
