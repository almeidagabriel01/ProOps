"use client";

/**
 * 403 Forbidden Page
 * 
 * Shown when a user tries to access a page they don't have permission for.
 */

import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { ShieldX, ArrowLeft, Home, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function ForbiddenPage() {
    const router = useRouter();
    const { user } = useAuth();

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
            <div className="max-w-md w-full text-center">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-red-500/10 rounded-full">
                        <ShieldX className="w-16 h-16 text-red-500" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-white mb-2">
                    Acesso Negado
                </h1>

                {/* Description */}
                <p className="text-neutral-400 mb-8">
                    Você não tem permissão para acessar esta página.
                    {user && (
                        <span className="block mt-2 text-sm">
                            Entre em contato com o administrador da sua conta para solicitar acesso.
                        </span>
                    )}
                </p>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                    </button>

                    <button
                        onClick={() => {
                            // Smart redirect: Check permissions and find first allowed page
                            // Similar logic to login redirect
                            const perms = user?.permissions || {};
                            const userRole = user?.role;
                            const isAdmin = ["admin", "superadmin", "MASTER"].includes(userRole || "");

                            const canViewDashboard = isAdmin || perms["dashboard"]?.canView === true;

                            if (canViewDashboard) {
                                router.push("/dashboard");
                            } else {
                                const pages = ["proposals", "clients", "products", "financial", "profile"];
                                const firstAllowed = pages.find(page => perms[page]?.canView === true || page === "profile");
                                router.push(firstAllowed ? `/${firstAllowed}` : "/login");
                            }
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        Início
                    </button>

                    <button
                        onClick={handleLogout}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/20 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair
                    </button>
                </div>

                {/* Error Code */}
                <p className="mt-8 text-neutral-600 text-sm">
                    Erro 403 - Forbidden
                </p>
            </div>
        </div>
    );
}
