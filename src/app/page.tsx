"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { HeroParallax } from "@/components/ui/hero-parallax";
import { Check, ArrowRight, Sparkles, Loader2 } from "lucide-react";

// Screenshots/Features para o Hero Parallax
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

// Planos
const plans = [
  {
    name: "Starter",
    price: "R$97",
    period: "/mês",
    description: "Ideal para pequenos negócios",
    features: [
      "Até 100 propostas/mês",
      "1 usuário",
      "Relatórios básicos",
      "Suporte por email",
    ],
    cta: "Começar Grátis",
    popular: false,
  },
  {
    name: "Professional",
    price: "R$197",
    period: "/mês",
    description: "Para empresas em crescimento",
    features: [
      "Propostas ilimitadas",
      "5 usuários",
      "Relatórios avançados",
      "Suporte prioritário",
      "Customização de temas",
      "API de integração",
    ],
    cta: "Assinar Agora",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "R$497",
    period: "/mês",
    description: "Para grandes operações",
    features: [
      "Tudo do Professional",
      "Usuários ilimitados",
      "Multi-tenant",
      "Suporte 24/7",
      "SLA garantido",
      "Onboarding dedicado",
    ],
    cta: "Falar com Vendas",
    popular: false,
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is logged in, redirect to dashboard if so
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      } else {
        setIsCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">ERP PRO</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Recursos
            </a>
            <a
              href="#pricing"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Planos
            </a>
            <a
              href="#contact"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Contato
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <button className="px-4 py-2 text-neutral-300 hover:text-white transition-colors">
                Entrar
              </button>
            </Link>
            <Link href="/login">
              <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium flex items-center gap-2 transition-colors">
                Começar Agora <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Parallax Section */}
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

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 bg-neutral-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Planos para todos os tamanhos
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              Escolha o plano ideal para sua empresa e comece a transformar sua
              gestão hoje mesmo.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-8 rounded-2xl border ${
                  plan.popular
                    ? "border-violet-500 bg-violet-500/10 shadow-xl scale-105"
                    : "border-neutral-800 bg-neutral-900"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-sm font-medium px-4 py-1 rounded-full">
                    Mais Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-neutral-400 text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-neutral-400">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-violet-500 shrink-0" />
                      <span className="text-sm text-neutral-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link href="/login">
                  <button
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      plan.popular
                        ? "bg-violet-600 hover:bg-violet-700 text-white"
                        : "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Pronto para transformar sua gestão?
          </h2>
          <p className="text-neutral-400 text-lg mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de empresas que já simplificaram suas operações
            com o ERP PRO.
          </p>
          <Link href="/login">
            <button className="px-8 py-4 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium text-lg flex items-center gap-2 mx-auto transition-colors">
              Começar Gratuitamente <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-12 px-4 border-t border-neutral-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">ERP PRO</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-neutral-400">
              <a href="#" className="hover:text-white transition-colors">
                Termos de Uso
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Privacidade
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Suporte
              </a>
            </div>

            <p className="text-sm text-neutral-500">
              © 2024 ERP PRO. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
