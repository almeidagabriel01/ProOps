"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SelectTenantStateProps = {
  title?: string;
  description?: string;
};

export function SelectTenantState({
  title = "Selecione uma empresa para continuar",
  description = "Você está como superadmin sem tenant ativo nesta aba.",
}: SelectTenantStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          {description}
        </p>
        <Link href="/admin">
          <Button>Ir para Painel Super Admin</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
