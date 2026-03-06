"use client";

import { HeroParallaxModern } from "@/components/ui/hero-parallax-modern";

const productCards = [
  { title: "Dashboard", thumbnail: "/hero/Dashboard.png" },
  { title: "CRM Kanban", thumbnail: "/hero/Kanban.png" },
  { title: "Carteiras", thumbnail: "/hero/Carteira.png" },
  { title: "Editor PDF", thumbnail: "/hero/PDF.png" },
];

function getProducts() {
  const allCards = [...productCards, ...productCards, ...productCards, ...productCards];

  return allCards.slice(0, 15).map((card) => ({
    title: card.title,
    link: "#modulos",
    thumbnail: card.thumbnail,
  }));
}

export function LandingHero() {
  return <HeroParallaxModern products={getProducts()} />;
}
