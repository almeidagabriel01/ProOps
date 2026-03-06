"use client";

import { useTheme } from "next-themes";
import { useMemo, useEffect, useState } from "react";
import { HeroParallaxModern } from "@/components/ui/hero-parallax-modern";

// Imagens base que existem em ambas as pastas
const baseProducts = [
  {
    title: "Dashboard",
    darkImage: "dashboard-dark.png",
    lightImage: "dashboard-light.png",
  },
  {
    title: "Propostas",
    darkImage: "proposals-dark.png",
    lightImage: "proposals.png",
  },
  {
    title: "Clientes",
    darkImage: "clients-dark.png",
    lightImage: "clients.png",
  },
  {
    title: "Produtos",
    darkImage: "products-dark.png",
    lightImage: "products.png",
  },
  {
    title: "Financeiro",
    darkImage: "financials-dark.png",
    lightImage: "financial.png",
  },
  { title: "Perfil", darkImage: "profile-dark.png", lightImage: "profile.png" },
  { title: "Equipe", darkImage: "team-dark.png", lightImage: "team.png" },
  {
    title: "Editar PDF",
    darkImage: "edit-pdf-dark.png",
    lightImage: "edit-pdf.png",
  },
  {
    title: "Visualizar PDF",
    darkImage: "view-pdf-dark.png",
    lightImage: "view-pdf.png",
  },
  {
    title: "Carteiras",
    darkImage: "wallets-dark.png",
    lightImage: "wallets-light.png",
  },
];

// Gerar produtos para uma pasta específica
function getProducts(folder: "dark" | "light") {
  const allProducts = [...baseProducts, ...baseProducts.slice(0, 5)];

  return allProducts.map((product) => ({
    title: product.title,
    link: "#features",
    thumbnail: `/hero/${folder}/${folder === "dark" ? product.darkImage : product.lightImage}`,
  }));
}

// Produtos padrão para SSR - usar light porque usuários em tema dark veem imagens light
const defaultProducts = getProducts("light");

export function LandingHero() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Só ativa após montar no cliente para evitar hydration mismatch
  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  // Quando tema light -> mostrar imagens dark (contraste)
  // Quando tema dark -> mostrar imagens light (contraste)
  const products = useMemo(() => {
    if (!mounted) return defaultProducts;
    const folder = resolvedTheme === "dark" ? "light" : "dark";
    return getProducts(folder);
  }, [resolvedTheme, mounted]);

  return <HeroParallaxModern products={products} />;
}
