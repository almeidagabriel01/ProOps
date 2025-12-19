"use client";

import { motion } from "motion/react";
import { AnimatedText } from "@/components/ui/animated-text";
import { SpotlightCard } from "@/components/ui/feature-card";
import { FileText, Users, Package, BarChart, Shield, Zap } from "lucide-react";
import ScrollStack, { ScrollStackItem } from "@/components/ui/scroll-stack";

export function LandingFeatures() {
    return (
        <>
            <section
                id="features"
                className="py-16 md:py-24 px-4 relative overflow-hidden"
            >
                {/* Background gradient */}
                {/* Background gradient removed */}


                <div className="max-w-7xl mx-auto relative z-10">
                    <motion.div
                        className="text-center mb-12 md:mb-20"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 text-foreground">
                            <AnimatedText text="Recursos poderosos" />
                        </h2>
                        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto px-4">
                            Tudo que você precisa para gerenciar seu negócio em uma única
                            plataforma
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
                            icon={<BarChart className="w-7 h-7" />}
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
                <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/30 -z-10" />

                <div className="max-w-4xl mx-auto px-4">
                    <motion.div
                        className="text-center mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 text-foreground">
                            <AnimatedText text="Como funciona" />
                        </h2>
                        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                            Comece a usar em minutos e transforme a gestão do seu negócio
                        </p>
                    </motion.div>

                    {/* ScrollStack */}
                    <ScrollStack>
                        <ScrollStackItem index={0} total={4}>
                            <div className="group relative p-6 md:p-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-2xl shadow-primary/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-primary/20 hover:scale-[1.02] cursor-pointer">
                                {/* Glow effect */}
                                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center relative z-10">
                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
                                        <Users className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                                            Cadastre sua empresa
                                        </h3>
                                        <p className="text-muted-foreground text-base md:text-lg leading-relaxed group-hover:text-foreground/80 transition-colors">
                                            Crie sua conta em segundos. Configure o perfil da sua
                                            empresa, adicione logo e informações de contato que
                                            aparecerão nas propostas.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </ScrollStackItem>

                        <ScrollStackItem index={1} total={4}>
                            <div className="group relative p-6 md:p-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-2xl shadow-primary/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-primary/20 hover:scale-[1.02] cursor-pointer">
                                {/* Glow effect */}
                                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center relative z-10">
                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow">
                                        <Package className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                                            Adicione seus produtos
                                        </h3>
                                        <p className="text-muted-foreground text-base md:text-lg leading-relaxed group-hover:text-foreground/80 transition-colors">
                                            Importe seu catálogo ou cadastre produtos manualmente.
                                            Defina preços, descrições e imagens que darão vida às suas
                                            propostas.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </ScrollStackItem>

                        <ScrollStackItem index={2} total={4}>
                            <div className="group relative p-6 md:p-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-2xl shadow-primary/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-primary/20 hover:scale-[1.02] cursor-pointer">
                                {/* Glow effect */}
                                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center relative z-10">
                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-shadow">
                                        <FileText className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                                            Crie propostas incríveis
                                        </h3>
                                        <p className="text-muted-foreground text-base md:text-lg leading-relaxed group-hover:text-foreground/80 transition-colors">
                                            Monte propostas profissionais em poucos cliques. Selecione
                                            produtos, personalize valores e envie direto para o
                                            cliente.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </ScrollStackItem>

                        <ScrollStackItem index={3} total={4}>
                            <div className="group relative p-6 md:p-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-2xl shadow-primary/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-primary/20 hover:scale-[1.02] cursor-pointer">
                                {/* Glow effect */}
                                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center relative z-10">
                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-shadow">
                                        <BarChart className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                                            Acompanhe resultados
                                        </h3>
                                        <p className="text-muted-foreground text-base md:text-lg leading-relaxed group-hover:text-foreground/80 transition-colors">
                                            Visualize métricas de vendas no dashboard. Entenda o que
                                            funciona e tome decisões baseadas em dados reais.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </ScrollStackItem>
                    </ScrollStack>
                </div>
            </section>
        </>
    );
}
