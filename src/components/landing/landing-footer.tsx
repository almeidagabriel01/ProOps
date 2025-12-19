"use client";

import { Sparkles } from "lucide-react";

export function LandingFooter() {
    return (
        <footer id="contact" className="py-12 px-4 border-t border-border bg-card">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-foreground">ERP PRO</span>
                    </div>

                    <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 text-sm text-muted-foreground">
                        <a href="#" className="hover:text-foreground transition-colors cursor-pointer">
                            Termos de Uso
                        </a>
                        <a href="#" className="hover:text-foreground transition-colors cursor-pointer">
                            Privacidade
                        </a>
                        <a href="#" className="hover:text-foreground transition-colors cursor-pointer">
                            Suporte
                        </a>
                    </div>

                    <p className="text-sm text-muted-foreground text-center">
                        © 2024 ERP PRO. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
}
