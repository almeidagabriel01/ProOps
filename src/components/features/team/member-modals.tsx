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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;

    const success = await updateMember({
      memberId: member.id,
      name,
      email,
      phoneNumber: phoneNumber || undefined,
      password: password || undefined,
    });
    if (success) {
      onSuccess();
      onOpenChange(false);
      setPassword("");
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Deixe em branco para manter a atual"
              minLength={6}
            />
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
