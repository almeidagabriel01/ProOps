"use client";

import { HeroParallax } from "@/components/ui/hero-parallax";

const products = [
    {
        title: "Dashboard",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
    },
    {
        title: "Propostas",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
    },
    {
        title: "Relatórios",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
    },
    {
        title: "Clientes",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop",
    },
    {
        title: "Produtos",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop",
    },
    {
        title: "Financeiro",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=600&fit=crop",
    },
    {
        title: "Configurações",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=600&fit=crop",
    },
    {
        title: "Multi-tenant",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=600&fit=crop",
    },
    {
        title: "PDF Export",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=600&fit=crop",
    },
    {
        title: "Themes",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop",
    },
    {
        title: "Analytics",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
    },
    {
        title: "API",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop",
    },
    {
        title: "Integrações",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=600&fit=crop",
    },
    {
        title: "Suporte",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=600&fit=crop",
    },
    {
        title: "Mobile",
        link: "#features",
        thumbnail:
            "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop",
    },
];

export function LandingHero() {
    return (
        <HeroParallax
            products={products}
            title={
                <>
                    O ERP completo para <br />{" "}
                    <span className="text-violet-500">sua empresa</span>
                </>
            }
            subtitle="Gerencie propostas, clientes, produtos e finanças em um só lugar. Simplifique sua operação e aumente sua produtividade com nossa plataforma intuitiva e moderna."
        />
    );
}
