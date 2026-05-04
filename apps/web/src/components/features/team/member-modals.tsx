"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, EyeOff } from "lucide-react";
import { useMemberActions } from "@/hooks/useMemberActions";
import { TeamMember } from "./team-types";

const buildMemberEditSnapshot = (data: {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
}): string =>
  JSON.stringify({
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    phoneNumber: data.phoneNumber.trim(),
    password: data.password,
  });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================
// EDIT MEMBER MODAL
// ============================================

interface EditMemberModalProps {
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditMemberModal({
  member,
  open,
  onOpenChange,
  onSuccess,
}: EditMemberModalProps) {
  const { updateMember, isLoading } = useMemberActions();
  const [name, setName] = React.useState(member.name);
  const [email, setEmail] = React.useState(member.email);
  const [phoneNumber, setPhoneNumber] = React.useState(
    member.phoneNumber || "",
  );
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [initialSnapshot, setInitialSnapshot] = React.useState("");

  React.useEffect(() => {
    if (!open) return;

    const memberName = member.name || "";
    const memberEmail = member.email || "";
    const memberPhone = member.phoneNumber || "";

    setName(memberName);
    setEmail(memberEmail);
    setPhoneNumber(memberPhone);
    setPassword("");
    setShowPassword(false);
    setErrors({});
    setInitialSnapshot(
      buildMemberEditSnapshot({
        name: memberName,
        email: memberEmail,
        phoneNumber: memberPhone,
        password: "",
      }),
    );
  }, [open, member]);

  const hasChanges = React.useMemo(
    () =>
      buildMemberEditSnapshot({
        name,
        email,
        phoneNumber,
        password,
      }) !== initialSnapshot,
    [name, email, phoneNumber, password, initialSnapshot],
  );

  const validateForm = React.useCallback(() => {
    const nextErrors: Record<string, string> = {};
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      nextErrors.name = "Nome é obrigatório";
    } else if (normalizedName.length < 2) {
      nextErrors.name = "Nome deve ter pelo menos 2 caracteres";
    }

    if (!normalizedEmail) {
      nextErrors.email = "E-mail é obrigatório";
    } else if (!EMAIL_REGEX.test(normalizedEmail)) {
      nextErrors.email = "Email invalido";
    }

    if (password && password.length < 6) {
      nextErrors.password = "Senha deve ter pelo menos 6 caracteres";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [name, email, password]);

  React.useEffect(() => {
    if (name.trim().length >= 2 && errors.name) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.name;
        return next;
      });
    }
  }, [name, errors.name]);

  React.useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail && EMAIL_REGEX.test(normalizedEmail) && errors.email) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.email;
        return next;
      });
    }
  }, [email, errors.email]);

  React.useEffect(() => {
    if ((!password || password.length >= 6) && errors.password) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.password;
        return next;
      });
    }
  }, [password, errors.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;
    if (!validateForm()) return;

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phoneNumber.trim();

    const success = await updateMember({
      memberId: member.id,
      name: normalizedName,
      email: normalizedEmail,
      phoneNumber: normalizedPhone || undefined,
      password: password || undefined,
    });
    if (success) {
      onSuccess();
      onOpenChange(false);
      setPassword("");
      setShowPassword(false);
      setErrors({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Membro</DialogTitle>
          <DialogDescription>
            Atualize as informações de {member.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <span className="text-sm text-destructive mt-1 block">
                {errors.name}
              </span>
            )}
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <span className="text-sm text-destructive mt-1 block">
                {errors.email}
              </span>
            )}
          </div>
          <div>
            <Label>WhatsApp / Telefone</Label>
            <PhoneInput
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          <div>
            <Label>Nova Senha (Opcional)</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para manter a atual"
                autoComplete="new-password"
                className={
                  errors.password ? "border-destructive pr-10" : "pr-10"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <span className="text-sm text-destructive mt-1 block">
                {errors.password}
              </span>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !name.trim() ||
                !email.trim() ||
                !hasChanges
              }
              className="gap-2"
            >
              {isLoading && <Spinner className="w-4 h-4 text-white" />}
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// DELETE MEMBER DIALOG
// ============================================

interface DeleteMemberDialogProps {
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteMemberDialog({
  member,
  open,
  onOpenChange,
  onSuccess,
}: DeleteMemberDialogProps) {
  const { deleteMember, isLoading } = useMemberActions();

  const handleDelete = async () => {
    const success = await deleteMember(member.id);
    if (success) {
      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover Membro?</AlertDialogTitle>
          <AlertDialogDescription>
            Você tem certeza que deseja remover <b>{member.name}</b>? Esta ação
            não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600 gap-2"
          >
            {isLoading && <Spinner className="w-4 h-4 text-white" />}
            {isLoading ? "Removendo..." : "Sim, Remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
