"use client";

import Link from "next/link";
import { Eye, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileSubjectMode } from "@/hooks/use-profile-subject";

interface ImpersonatedProfileNoticeProps {
  mode: Exclude<ProfileSubjectMode, "self">;
  personName: string | null;
  companyName: string | null;
}

/**
 * Aviso do Perfil aberto pelo super admin dentro do "Acessar Painel": diz de
 * quem são os dados na tela (o dono ou o membro visto) e que nada aqui é
 * editável, porque salvar gravaria na conta do próprio super admin.
 */
export function ImpersonatedProfileNotice({
  mode,
  personName,
  companyName,
}: ImpersonatedProfileNoticeProps) {
  const isMember = mode === "member";
  const person = personName || (isMember ? "este membro" : "o dono");
  const company = companyName || "esta empresa";
  const Icon = isMember ? UserRound : Eye;

  return (
    <div
      role="status"
      data-testid="impersonated-profile-notice"
      data-mode={mode}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-sm",
        isMember
          ? "border-sky-500/40 bg-sky-500/10"
          : "border-border bg-muted/40",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isMember ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {isMember ? (
            <>
              Você está vendo o perfil de <strong>{person}</strong>, membro da
              equipe da <strong>{company}</strong>, como super admin.
            </>
          ) : (
            <>
              Você está vendo o perfil de <strong>{person}</strong>, dono da{" "}
              <strong>{company}</strong>, como super admin.
            </>
          )}
        </p>
        <p className="text-muted-foreground">
          Os dados pessoais ficam somente leitura aqui. Para mudar o e-mail ou a
          senha de acesso, use a aba Acesso da empresa no{" "}
          <Link href="/admin" className="font-medium text-foreground underline underline-offset-2">
            painel do super admin
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
