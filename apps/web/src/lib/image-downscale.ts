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
