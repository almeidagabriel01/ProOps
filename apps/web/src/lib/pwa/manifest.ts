import type { MetadataRoute } from "next";

import type { Surface } from "@/lib/site/surfaces";

/**
 * Onde o app instalado abre. `/login` e não `/dashboard`: com sessão, a tela
 * de login leva cada pessoa para a home DELA (`resolveUserHome`), e um membro
 * sem permissão no Dashboard tem outra home. Sem sessão, é a própria tela de
 * entrar.
 */
export const INSTALLED_START_URL = "/login";

const ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  {
    src: "/icons/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];

/**
 * O manifest de cada superfície.
 *
 * Os três domínios são servidos pelo mesmo projeto, e um manifest fixo deixava
 * "instalar" qualquer um deles com `start_url: "/"`: no `erp.` isso abria a
 * landing de vendas, no apex a página da empresa e no `app.` a página do
 * aplicativo de celular. Só o ERP é instalável; nos outros dois o
 * `display: "browser"` faz o navegador não oferecer a instalação, sem um 404
 * no lugar do manifest.
 */
export function buildWebManifest(
  surface: Surface,
  description: string,
): MetadataRoute.Manifest {
  const base = {
    name: "ProOps - ERP para gestão de serviços",
    short_name: "ProOps",
    description,
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: ICONS,
  } satisfies MetadataRoute.Manifest;

  if (surface !== "erp") {
    return { ...base, start_url: "/", display: "browser" };
  }

  return {
    ...base,
    // `id` estável: o navegador reconhece a instalação pelo id, e mudar o
    // `start_url` depois não cria um segundo app na tela inicial.
    id: "/",
    scope: "/",
    start_url: INSTALLED_START_URL,
    display: "standalone",
  };
}
