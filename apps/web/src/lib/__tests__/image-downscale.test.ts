import { describe, it, expect, vi } from "vitest";
import {
  CATALOG_IMAGE_MAX_DIMENSION,
  CATALOG_IMAGE_SKIP_BELOW_BYTES,
  downscaleCatalogImage,
  fitWithin,
  shouldDownscaleCatalogImage,
} from "../image-downscale";

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


describe("shouldDownscaleCatalogImage", () => {
  const small = { width: 800, height: 600, size: 100 * 1024 };
  it("foto de celular grande é reduzida", () => {
    expect(shouldDownscaleCatalogImage({ type: "image/jpeg", width: 4000, height: 3000, size: 4_000_000 })).toBe(true);
  });
  it("dimensão acima do teto é reduzida mesmo com arquivo leve", () => {
    expect(shouldDownscaleCatalogImage({ type: "image/png", width: CATALOG_IMAGE_MAX_DIMENSION + 1, height: 10, size: 1000 })).toBe(true);
  });
  it("arquivo pesado dentro do teto é regravado", () => {
    expect(shouldDownscaleCatalogImage({ type: "image/png", width: 1200, height: 1200, size: CATALOG_IMAGE_SKIP_BELOW_BYTES + 1 })).toBe(true);
  });
  it("imagem pequena e leve passa direto", () => {
    expect(shouldDownscaleCatalogImage({ type: "image/jpeg", ...small })).toBe(false);
  });
  it("GIF e SVG nunca são reprocessados", () => {
    expect(shouldDownscaleCatalogImage({ type: "image/gif", width: 4000, height: 4000, size: 4_000_000 })).toBe(false);
    expect(shouldDownscaleCatalogImage({ type: "image/svg+xml", width: 4000, height: 4000, size: 4_000_000 })).toBe(false);
  });
});

describe("downscaleCatalogImage", () => {
  it("tipo não redimensionável volta intacto", async () => {
    const gif = new File(["x"], "a.gif", { type: "image/gif" });
    await expect(downscaleCatalogImage(gif)).resolves.toBe(gif);
  });
  it("falha ao decodificar nunca impede o upload: devolve o original", async () => {
    const spy = vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("boom");
    });
    const jpg = new File(["x"], "a.jpg", { type: "image/jpeg" });
    await expect(downscaleCatalogImage(jpg)).resolves.toBe(jpg);
    spy.mockRestore();
  });
});
