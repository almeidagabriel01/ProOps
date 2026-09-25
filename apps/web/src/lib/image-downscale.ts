"use client";

/**
 * Reduz uma imagem para caber como data URL dentro de um documento do
 * Firestore (limite de 1 MiB por documento).
 *
 * O logo da empresa e gravado em `tenants/{id}.logoUrl`. O painel aceitava
 * arquivo de ate 2 MB e gravava o base64 inteiro: acima de ~750 KB o save
 * falhava, e abaixo disso o doc do tenant (lido em todo caminho de auth) ficava
 * pesado a toa. Um logo nao precisa de mais que 256 px.
 */

export const LOGO_MAX_DIMENSION = 256;
export const LOGO_MAX_DATA_URL_BYTES = 200 * 1024;

export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    img.src = src;
  });
}

/**
 * Devolve um data URL PNG com no maximo `LOGO_MAX_DIMENSION` px no maior lado.
 * SVG passa direto (ja e vetorial e pequeno). Lanca `LOGO_TOO_LARGE` se nem
 * reduzida a imagem couber no limite.
 */
export async function downscaleLogo(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  if (file.type === "image/svg+xml") {
    if (original.length > LOGO_MAX_DATA_URL_BYTES) throw new Error("LOGO_TOO_LARGE");
    return original;
  }

  const img = await loadImage(original);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, LOGO_MAX_DIMENSION);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("IMAGE_DECODE_FAILED");
  ctx.drawImage(img, 0, 0, width, height);
  const result = canvas.toDataURL("image/png");
  if (result.length > LOGO_MAX_DATA_URL_BYTES) throw new Error("LOGO_TOO_LARGE");
  return result;
}

// ---------------------------------------------------------------------------
// Imagens de catálogo (produto / serviço)
// ---------------------------------------------------------------------------

/**
 * Foto de celular chega com 3 a 5 MB e 4000 px. No catálogo ela é exibida como
 * miniatura e, no PDF, em poucos centímetros: subir o original deixava o
 * cadastro lento (upload) e a lista pesada (download). 1600 px no maior lado
 * cobre com folga a impressão em A4 dentro da proposta.
 */
export const CATALOG_IMAGE_MAX_DIMENSION = 1600;
export const CATALOG_IMAGE_SKIP_BELOW_BYTES = 400 * 1024;
const CATALOG_IMAGE_QUALITY = 0.85;
const DOWNSCALABLE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/** Pura: decide se vale reprocessar. GIF (animação) e SVG passam direto. */
export function shouldDownscaleCatalogImage(input: {
  type: string;
  size: number;
  width: number;
  height: number;
}): boolean {
  if (!DOWNSCALABLE_TYPES.has(input.type)) return false;
  const oversized =
    input.width > CATALOG_IMAGE_MAX_DIMENSION || input.height > CATALOG_IMAGE_MAX_DIMENSION;
  return oversized || input.size > CATALOG_IMAGE_SKIP_BELOW_BYTES;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Reduz a imagem para no máximo 1600 px e a regrava em WebP (mantém a
 * transparência de PNG). Nunca impede o upload: qualquer falha, ou um
 * resultado maior que o original, devolve o arquivo original.
 */
export async function downscaleCatalogImage(file: File): Promise<File> {
  if (!DOWNSCALABLE_TYPES.has(file.type)) return file;
  try {
    const url = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    if (
      !shouldDownscaleCatalogImage({
        type: file.type,
        size: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    ) {
      return file;
    }

    const { width, height } = fitWithin(
      img.naturalWidth,
      img.naturalHeight,
      CATALOG_IMAGE_MAX_DIMENSION,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/webp", CATALOG_IMAGE_QUALITY);
    // Navegador sem encoder WebP devolve PNG no lugar; aí não compensa.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagem";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
