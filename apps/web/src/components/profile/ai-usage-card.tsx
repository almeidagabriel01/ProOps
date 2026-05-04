"use client";

import { useLiaUsage } from "@/hooks/useLiaUsage";
import { useAuth } from "@/providers/auth-provider";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotMessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiUsageCard() {
  const { user } = useAuth();
  const { messagesUsed, messagesLimit, resetDate, isLoading, isNearLimit, isAtLimit } = useLiaUsage();

  // Free plan has no AI access — hide the card entirely
  // user?.role is "free" for free plan users (planTier from usePlanLimits defaults "starter" for free — unreliable)
  if (!user || user.role === "free") return null;
  if (isLoading) return null;

  const percentage = messagesLimit > 0 ? Math.round((messagesUsed / messagesLimit) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BotMessageSquare className="w-4 h-4" />
          Lia — Uso de Mensagens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress
          value={Math.min(percentage, 100)}
          className={cn(
            "h-2",
            isAtLimit
              ? "[&>div]:bg-destructive"
              : isNearLimit
                ? "[&>div]:bg-amber-500"
                : "",
          )}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {messagesUsed} de {messagesLimit} mensagens usadas
          </span>
          <span>Renova em {resetDate}</span>
        </div>
      </CardContent>
    </Card>
  );
}
