"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { HeroParallax } from "@/components/ui/hero-parallax";
import { Check, ArrowRight, Sparkles, Loader2, FileText, Users, Package, BarChart3, Shield, Zap } from "lucide-react";
import { motion } from "motion/react";
import { AnimatedText, AnimatedGradientText } from "@/components/ui/animated-text";
import { ParticlesBackground } from "@/components/ui/particles-background";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { SpotlightCard } from "@/components/ui/feature-card";
import ScrollStack, { ScrollStackItem } from "@/components/ui/scroll-stack";

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

// Navigation links for mobile menu
const navLinks = [
  { label: "Recursos", href: "#features" },
  { label: "Planos", href: "#pricing" },
  { label: "Contato", href: "#contact" },
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/70 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              ERP PRO
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <a
              href="#features"
              className="px-4 py-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
            >
              Recursos
            </a>
            <a
              href="#pricing"
              className="px-4 py-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
            >
              Planos
            </a>
            <a
              href="#contact"
              className="px-4 py-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
            >
              Contato
            </a>
          </nav>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden md:block">
              <button className="px-4 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-all duration-200 cursor-pointer">
                Entrar
              </button>
            </Link>
            <Link href="/login" className="hidden md:block">
              <button className="group relative px-5 py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-xl font-medium flex items-center gap-2 transition-all duration-300 cursor-pointer shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105">
                <span>Começar Agora</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </Link>
            {/* Mobile Menu */}
            <MobileMenu links={navLinks} />
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

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 px-4 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-900/20 to-neutral-950" />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            className="text-center mb-12 md:mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4">
              <AnimatedText text="Recursos poderosos" />
            </h2>
            <p className="text-neutral-400 text-base md:text-lg max-w-2xl mx-auto px-4">
              Tudo que você precisa para gerenciar seu negócio em uma única plataforma
            </p>
          </motion.div>

          {/* Spotlight Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <SpotlightCard
              index={0}
              icon={<FileText className="w-7 h-7" />}
              title="Propostas Profissionais"
              description="Crie propostas impressionantes em minutos. Personalize templates e exporte para PDF com sua marca."
            />
            <SpotlightCard
              index={1}
              icon={<Users className="w-7 h-7" />}
              title="Gestão de Clientes"
              description="Centralize todos os dados dos seus clientes. Acompanhe histórico de interações e negociações."
            />
            <SpotlightCard
              index={2}
              icon={<Package className="w-7 h-7" />}
              title="Catálogo de Produtos"
              description="Organize seu catálogo com fotos, preços e categorias. Atualizações refletem em todas as propostas."
            />
            <SpotlightCard
              index={3}
              icon={<BarChart3 className="w-7 h-7" />}
              title="Dashboard Inteligente"
              description="Visualize métricas importantes em tempo real. Acompanhe vendas, metas e desempenho da equipe."
            />
            <SpotlightCard
              index={4}
              icon={<Shield className="w-7 h-7" />}
              title="Seguro e Confiável"
              description="Seus dados protegidos com criptografia de ponta. Backups automáticos e acesso controlado."
            />
            <SpotlightCard
              index={5}
              icon={<Zap className="w-7 h-7" />}
              title="Rápido e Intuitivo"
              description="Interface moderna que sua equipe aprende em minutos. Sem complicação, sem treinamento extensivo."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section - Stacking Cards */}
      <section className="relative py-16 md:py-24">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 to-neutral-900/50 -z-10" />

        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4">
              <AnimatedText text="Como funciona" />
            </h2>
            <p className="text-neutral-400 text-base md:text-lg max-w-2xl mx-auto">
              Comece a usar em minutos e transforme a gestão do seu negócio
            </p>
          </motion.div>

          {/* ScrollStack */}
          <ScrollStack>
            <ScrollStackItem index={0} total={4}>
              <div className="group relative p-6 md:p-8 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-950/80 via-neutral-900/95 to-neutral-950/90 shadow-2xl shadow-violet-500/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-violet-500/40 hover:shadow-violet-500/20 hover:scale-[1.02] cursor-pointer">
                {/* Glow effect */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center relative z-10">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-violet-200 transition-colors">Cadastre sua empresa</h3>
                    <p className="text-neutral-400 text-base md:text-lg leading-relaxed group-hover:text-neutral-300 transition-colors">
                      Crie sua conta em segundos. Configure o perfil da sua empresa, adicione logo e informações de contato que aparecerão nas propostas.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollStackItem>

            <ScrollStackItem index={1} total={4}>
              <div className="group relative p-6 md:p-8 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/80 via-neutral-900/95 to-neutral-950/90 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-cyan-500/40 hover:shadow-cyan-500/20 hover:scale-[1.02] cursor-pointer">
                {/* Glow effect */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center relative z-10">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow">
                    <Package className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-cyan-200 transition-colors">Adicione seus produtos</h3>
                    <p className="text-neutral-400 text-base md:text-lg leading-relaxed group-hover:text-neutral-300 transition-colors">
                      Importe seu catálogo ou cadastre produtos manualmente. Defina preços, descrições e imagens que darão vida às suas propostas.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollStackItem>

            <ScrollStackItem index={2} total={4}>
              <div className="group relative p-6 md:p-8 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/80 via-neutral-900/95 to-neutral-950/90 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-emerald-500/40 hover:shadow-emerald-500/20 hover:scale-[1.02] cursor-pointer">
                {/* Glow effect */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center relative z-10">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-shadow">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-emerald-200 transition-colors">Crie propostas incríveis</h3>
                    <p className="text-neutral-400 text-base md:text-lg leading-relaxed group-hover:text-neutral-300 transition-colors">
                      Monte propostas profissionais em poucos cliques. Selecione produtos, personalize valores e envie direto para o cliente.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollStackItem>

            <ScrollStackItem index={3} total={4}>
              <div className="group relative p-6 md:p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-950/80 via-neutral-900/95 to-neutral-950/90 shadow-2xl shadow-amber-500/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-amber-500/40 hover:shadow-amber-500/20 hover:scale-[1.02] cursor-pointer">
                {/* Glow effect */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center relative z-10">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-shadow">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-amber-200 transition-colors">Acompanhe resultados</h3>
                    <p className="text-neutral-400 text-base md:text-lg leading-relaxed group-hover:text-neutral-300 transition-colors">
                      Visualize métricas de vendas no dashboard. Entenda o que funciona e tome decisões baseadas em dados reais.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollStackItem>
          </ScrollStack>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-24 px-4 bg-neutral-900/50 relative overflow-hidden">
        {/* Background Effects */}
        <ParticlesBackground count={30} />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12 md:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4">
                <AnimatedText text="Planos para todos os tamanhos" />
              </h2>
            </motion.div>
            <motion.p
              className="text-neutral-400 text-base md:text-lg max-w-2xl mx-auto px-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Escolha o plano ideal para sua empresa e comece a transformar sua
              gestão hoje mesmo.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.15,
                  ease: [0.21, 0.47, 0.32, 0.98]
                }}
                whileHover={{
                  y: -8,
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                className={`relative p-6 md:p-8 rounded-2xl border flex flex-col h-full group/card ${plan.popular
                  ? "border-violet-500 bg-gradient-to-b from-violet-500/20 to-violet-500/5 shadow-xl shadow-violet-500/20 md:scale-105 hover:shadow-violet-500/40"
                  : "border-neutral-800 bg-neutral-900 hover:border-violet-500/50 hover:bg-neutral-900/80 hover:shadow-lg hover:shadow-violet-500/10"
                  } transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 bg-violet-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-md shadow-violet-500/30">
                      <Sparkles className="w-3 h-3" />
                      Mais Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-neutral-400 text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-3xl md:text-4xl font-bold">
                    <AnimatedGradientText>{plan.price}</AnimatedGradientText>
                  </span>
                  <span className="text-neutral-400">{plan.period}</span>
                </div>

                {/* Features list with flex-grow to push button to bottom */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, featureIndex) => (
                    <motion.li
                      key={feature}
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.15 + featureIndex * 0.05
                      }}
                    >
                      <div className={`p-1 rounded-full ${plan.popular ? 'bg-violet-500/20' : 'bg-neutral-800'}`}>
                        <Check className="w-4 h-4 text-violet-500 shrink-0" />
                      </div>
                      <span className="text-sm text-neutral-300">
                        {feature}
                      </span>
                    </motion.li>
                  ))}
                </ul>

                {/* Button always at bottom */}
                <Link href="/login" className="mt-auto">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`group w-full py-3.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${plan.popular
                      ? "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50"
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-violet-500/30"
                      }`}
                  >
                    <span>{plan.cta}</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </motion.button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            className="text-2xl sm:text-3xl md:text-5xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Pronto para transformar sua gestão?
          </motion.h2>
          <motion.p
            className="text-neutral-400 text-base md:text-lg mb-8 max-w-2xl mx-auto px-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Junte-se a centenas de empresas que já simplificaram suas operações
            com o ERP PRO.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link href="/login">
              <motion.button
                className="group relative px-8 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-xl font-medium text-lg flex items-center gap-3 mx-auto transition-all duration-300 cursor-pointer shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Começar Gratuitamente</span>
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </motion.button>
            </Link>
          </motion.div>
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

            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 text-sm text-neutral-400">
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

            <p className="text-sm text-neutral-500 text-center">
              © 2024 ERP PRO. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
