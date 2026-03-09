"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuth } from "@/providers/auth-provider";
import { auth } from "@/lib/firebase";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";

export function PasswordForm() {
  const { logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasPasswordProvider, setHasPasswordProvider] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const hasPassword =
        firebaseUser?.providerData?.some(
          (provider) => provider.providerId === "password",
        ) || false;
      setHasPasswordProvider(hasPassword);
    });

    return () => unsubscribe();
  }, []);

  // We only enable the save button if passwords match and have sufficient length
  const hasChanges =
    currentPassword.length > 0 &&
    newPassword.trim().length >= 6 &&
    newPassword === confirmPassword;

  const handleSave = async () => {
    if (!hasChanges) return;

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (newPassword.trim().length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres válidos.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !user?.email) {
      toast.error("Usuário não autenticado.");
      return;
    }

    setIsLoading(true);

    try {
      // First, reauthenticate the user to ensure they have a recent login
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Now we can safely update the password
      await updatePassword(currentUser, newPassword);

      toast.success("Senha alterada com sucesso! Você será desconectado.");

      // Logout the user, requiring them to login again
      await logout();
    } catch (error: unknown) {
      console.error(error);
      const err = error as { code?: string; message?: string };
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        toast.error("Senha atual incorreta.");
      } else if (err.code === "auth/requires-recent-login") {
        toast.error(
          "Sua sessão expirou. Por favor, faça login novamente para alterar a senha.",
        );
      } else {
        toast.error("Erro ao alterar a senha. Tente novamente mais tarde.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasPasswordProvider) {
    return null;
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Lock className="w-5 h-5 text-primary" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Atualize sua senha de acesso ao sistema. Você será desconectado após
            a alteração.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsEditing(!isEditing)}
          className="shrink-0"
        >
          <div className="sr-only">Editar</div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </Button>
      </CardHeader>

      {isEditing && (
        <>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-9 pr-9"
                  placeholder="Sua senha atual"
                />
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-9"
                  placeholder="No mínimo 6 caracteres"
                />
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 pr-9"
                  placeholder="Confirme a nova senha"
                />
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/10 px-6 py-4">
            <div className="flex w-full justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Atualizar Senha
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
