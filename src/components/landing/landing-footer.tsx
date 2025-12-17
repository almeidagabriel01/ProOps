"use client";

import { Sparkles } from "lucide-react";

export function LandingFooter() {
    return (
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
    );
}
