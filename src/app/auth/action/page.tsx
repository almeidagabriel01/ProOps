"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode, getAuth, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase"; // Ensure this import path is correct for your project
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "react-toastify";

function AuthActionContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");

    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        if (!oobCode) {
            setError("Código de verificação inválido ou ausente.");
            setIsVerifying(false);
            return;
        }

        // Verify the code immediately on load
        verifyPasswordResetCode(auth, oobCode)
            .then((email) => {
                setEmail(email);
                setIsVerifying(false);
            })
            .catch((error) => {
                console.error(error);
                setError("O link de redefinição de senha é inválido ou expirou.");
                setIsVerifying(false);
            });
    }, [oobCode]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmNewPassword) {
            toast.error("As senhas não coincidem.");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        if (!oobCode) return;

        setIsLoading(true);
        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            // Sign out the user to ensure they log in with the new password
            await signOut(auth);

            setSuccess(true);
            toast.success("Senha alterada com sucesso! Faça login com a nova senha.");
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erro ao redefinir senha.");
            setError(error.message || "Ocorreu um erro ao redefinir sua senha.");
        } finally {
            setIsLoading(false);
        }
    };

    if (mode !== "resetPassword") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <XCircle className="w-5 h-5" />
                            Ação Inválida
                        </CardTitle>
                        <CardDescription>
                            O tipo de ação solicitada não é suportado ou o link está incorreto.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button onClick={() => router.push("/login")} className="w-full">
                            Voltar para o Login
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (isVerifying) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-md text-center py-10">
                    <CardContent>
                        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
                        <p className="text-muted-foreground">Verificando seu link...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <XCircle className="w-5 h-5" />
                            Link Inválido
                        </CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button onClick={() => router.push("/login")} className="w-full">
                            Voltar para o Login
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-green-600 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Senha Alterada!
                        </CardTitle>
                        <CardDescription>
                            Sua senha foi atualizada com sucesso. Você será redirecionado para o login em instantes.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button onClick={() => router.push("/login")} className="w-full">
                            Ir para o Login
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-primary" />
                        Redefinir Senha
                    </CardTitle>
                    <CardDescription>
                        Defina uma nova senha para sua conta {email ? `(${email})` : ""}.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleResetPassword}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Nova Senha</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmNewPassword">Confirmar Nova Senha</Label>
                            <Input
                                id="confirmNewPassword"
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Alterando...
                                </>
                            ) : (
                                "Alterar Senha"
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

export default function AuthActionPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <AuthActionContent />
        </Suspense>
    );
}
