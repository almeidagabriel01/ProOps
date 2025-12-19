"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

export function LandingCTA() {
    return (
        <section className="py-16 md:py-24 px-4 bg-muted/30">
            <div className="max-w-4xl mx-auto text-center">
                <motion.h2
                    className="text-2xl sm:text-3xl md:text-5xl font-bold mb-6 text-foreground"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    Pronto para transformar sua gestão?
                </motion.h2>
                <motion.p
                    className="text-muted-foreground text-base md:text-lg mb-8 max-w-2xl mx-auto px-4"
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
                            className="group relative px-8 py-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground rounded-xl font-medium text-lg flex items-center gap-3 mx-auto transition-all duration-300 cursor-pointer shadow-xl shadow-primary/30 hover:shadow-primary/50"
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
    );
}
