/**
 * The share image of the ERP pages (`og:image`).
 *
 * The root layout declares it, but Next replaces the whole `openGraph` object
 * of a parent when a page declares its own, so every page that sets a title
 * or url there has to repeat the image. Without it the link pasted on
 * WhatsApp, the channel sales happen on, shows no picture. Guard:
 * `__tests__/canonical-por-rota.test.ts`.
 */
export const OG_IMAGE_PADRAO = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "ProOps - ERP para gestão de serviços",
} as const;

export const OG_IMAGES_PADRAO = [OG_IMAGE_PADRAO];
