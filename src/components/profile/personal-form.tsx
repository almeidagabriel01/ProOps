"use client";

import { useState } from "react";
import { User } from "@/types";
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
import { Mail, User as UserIcon, Loader2, Save, Palette } from "lucide-react";
import { UserService } from "@/services/user-service";
import { toast } from "react-toastify";

interface PersonalFormProps {
  user: User | null;
}

export function PersonalForm({ user }: PersonalFormProps) {
  const [name, setName] = useState(user?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const hasChanges = name !== user?.name && name.trim().length > 0;

  const handleSave = async () => {
    if (!user || !hasChanges) return;

    setIsLoading(true);
    try {
      await UserService.updateUser(user.id, { name });
      toast.success("Nome atualizado com sucesso!");
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar nome.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <UserIcon className="w-5 h-5 text-primary" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>
            Gerencie seus dados de identificação e segurança.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsEditing(!isEditing)}
          className="shrink-0"
        >
          <div className="sr-only">Editar</div>
          <Palette className="w-4 h-4 hidden" />{" "}
          {/* Dummy to keep import if needed, or better use Pencil */}
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
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Label htmlFor="name">Nome Completo</Label>
          <div className="relative">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-9"
              placeholder="Seu nome"
              disabled={!isEditing}
            />
            <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              value={user?.email || ""}
              readOnly
              className="pl-9 bg-muted/50 text-muted-foreground"
              disabled
            />
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
      {isEditing && (
        <CardFooter className="border-t bg-muted/10 px-6 py-4">
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
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
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
