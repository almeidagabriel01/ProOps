"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus, HelpCircle } from "lucide-react";
import { AnimatedText } from "@/components/ui/animated-text";

const FAQS = [
    {
        question: "Como funciona o pagamento? É seguro?",
        answer: "Sim, totalmente seguro. Utilizamos gateways de pagamento líderes de mercado com criptografia de ponta (SSL) para processar todas as transações. Seus dados financeiros nunca são armazenados em nossos servidores.",
    },
    {
        question: "O que acontece após o pagamento?",
        answer: "Assim que o pagamento for confirmado, seu acesso é liberado imediatamente. Você já poderá acessar sua conta e começar a configurar seu ambiente, sem necessidade de aguardar longos períodos.",
    },
    {
        question: "Posso cancelar minha assinatura a qualquer momento?",
        answer: "Sim! Não acreditamos em fidelidade forçada. Você pode cancelar sua assinatura quando quiser diretamente pelo painel, sem burocracia ou multas.",
    },
    {
        question: "Preciso instalar algum software no meu computador?",
        answer: "Não. Nossa plataforma é 100% baseada na nuvem. Você pode acessar de qualquer dispositivo com internet (computador ou notebook) e seus dados estarão sempre sincronizados.",
    },
    {
        question: "Como funciona o sistema de propostas?",
        answer: "Nosso gerador de propostas é intuitivo e poderoso. Você cadastra seus produtos/serviços e clientes, e em poucos cliques gera um PDF profissional e personalizado pronto para enviar.",
    },
    {
        question: "Tenho suporte em caso de dúvidas?",
        answer: "Com certeza. Oferecemos suporte especializado para ajudar você em todas as etapas, desde a configuração inicial até dúvidas do dia a dia.",
    },
];

export function LandingFAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="py-16 md:py-24 px-4 relative overflow-hidden bg-background">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-linear-to-b from-muted/30 to-background -z-10" />

            <div className="max-w-4xl mx-auto relative z-10">
                <motion.div
                    className="text-center mb-12 md:mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                        <HelpCircle className="w-4 h-4" />
                        <span>Tire suas dúvidas</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 text-foreground">
                        <AnimatedText text="Perguntas Frequentes" />
                    </h2>
                    <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                        Separamos as principais dúvidas para te ajudar a entender tudo sobre nossa plataforma.
                    </p>
                </motion.div>

                <div className="space-y-4">
                    {FAQS.map((faq, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="border border-border rounded-xl bg-card overflow-hidden hover:border-primary/30 transition-colors duration-300"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full flex items-center justify-between p-6 text-left cursor-pointer focus:outline-none"
                            >
                                <span className="font-semibold text-lg text-foreground pr-8">
                                    {faq.question}
                                </span>
                                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${openIndex === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    {openIndex === index ? (
                                        <Minus className="w-4 h-4" />
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                </span>
                            </button>

                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                    >
                                        <div className="px-6 pb-6 text-muted-foreground leading-relaxed">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
