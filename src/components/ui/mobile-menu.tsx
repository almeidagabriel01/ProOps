"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";

interface MobileMenuProps {
    links: { label: string; href: string }[];
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ links }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);
    const closeMenu = () => setIsOpen(false);

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={toggleMenu}
                className="md:hidden relative z-50 p-2 text-white"
                aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
            >
                <motion.div
                    animate={isOpen ? "open" : "closed"}
                >
                    {isOpen ? (
                        <X className="w-6 h-6" />
                    ) : (
                        <Menu className="w-6 h-6" />
                    )}
                </motion.div>
            </button>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                            onClick={closeMenu}
                        />

                        {/* Menu Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-[280px] bg-neutral-900 border-l border-neutral-800 z-50 md:hidden"
                        >
                            <div className="flex flex-col h-full pt-20 px-6">
                                <nav className="flex flex-col gap-2">
                                    {links.map((link, index) => (
                                        <motion.a
                                            key={link.href}
                                            href={link.href}
                                            onClick={closeMenu}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="text-lg text-neutral-300 hover:text-white py-3 px-4 rounded-lg hover:bg-neutral-800 transition-colors"
                                        >
                                            {link.label}
                                        </motion.a>
                                    ))}
                                </nav>

                                <div className="mt-auto pb-8 space-y-3">
                                    <Link href="/login" onClick={closeMenu}>
                                        <button className="w-full py-3 text-neutral-300 hover:text-white rounded-lg border border-neutral-700 hover:bg-neutral-800 transition-colors cursor-pointer">
                                            Entrar
                                        </button>
                                    </Link>
                                    <Link href="/login" onClick={closeMenu}>
                                        <button className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors cursor-pointer">
                                            Começar Agora
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
