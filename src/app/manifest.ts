import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProOps — ERP para gestão de serviços",
    short_name: "ProOps",
    description:
      "ERP completo para automação residencial, cortinas e empresas de serviço.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: "pt-BR",
    categories: ["business", "productivity"],
  };
}
