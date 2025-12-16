"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UpgradeRequiredProps {
  feature: string;
  description?: string;
}

export function UpgradeRequired({
  feature,
  description,
}: UpgradeRequiredProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <Card className="max-w-md w-full border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-primary" />
          </div>

          <h2 className="text-2xl font-bold mb-2">Recurso Bloqueado</h2>

          <p className="text-muted-foreground mb-6">
            {description ||
              `O módulo "${feature}" não está disponível no seu plano atual.`}
          </p>

          <Link href="/profile">
            <Button size="lg" className="gap-2">
              <Sparkles className="w-5 h-5" />
              Fazer Upgrade
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground mt-4">
            Faça upgrade para desbloquear este e outros recursos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
