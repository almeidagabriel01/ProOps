"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useWhatsAppInfo } from "@/hooks/useWhatsAppInfo";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface WhatsAppContactCardProps {
  displayPhoneNumber: string;
  waLink: string;
}

function WhatsAppContactCard({ displayPhoneNumber, waLink }: WhatsAppContactCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayPhoneNumber);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = displayPhoneNumber;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
          Número do bot
        </CardTitle>
        <CardDescription>
          Salve este número nos seus contatos e envie qualquer mensagem para iniciar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-6 bg-muted/40 rounded-lg border">
          <span className="text-3xl font-bold tracking-wide tabular-nums">
            {displayPhoneNumber}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild className="flex-1 gap-2">
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Iniciar conversa
            </a>
          </Button>

          <Button
            variant="outline"
            onClick={() => void handleCopy()}
            className={cn("flex-1 gap-2 transition-colors", copied && "text-green-600 border-green-300")}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                Copiar número
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

interface WhatsAppUsageCardProps {
  month: string;
  totalMessages: number;
  includedMessages: number;
  overageMessages: number;
  monthlyLimit: number;
}

function WhatsAppUsageCard({
  month,
  totalMessages,
  includedMessages,
  overageMessages,
  monthlyLimit,
}: WhatsAppUsageCardProps) {
  const progressPercent = monthlyLimit > 0
    ? Math.min(100, (totalMessages / monthlyLimit) * 100)
    : 0;

  const formattedMonth = (() => {
    try {
      // month is expected as "YYYY-MM"
      const [year, monthNum] = month.split("-");
      return new Date(Number(year), Number(monthNum) - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return month;
    }
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Uso este mês</CardTitle>
        <CardDescription className="capitalize">{formattedMonth}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-3" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{totalMessages}</span> de{" "}
            <span className="font-semibold text-foreground">{includedMessages}</span> mensagens incluídas
          </p>
        </div>

        {overageMessages > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">{overageMessages}</span> mensagens de excedente serão cobradas na próxima fatura
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function WhatsAppPageSkeleton() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 flex-1 rounded-md" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WhatsAppPage() {
  const { data, loading, error } = useWhatsAppInfo();

  if (loading) return <WhatsAppPageSkeleton />;

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-destructive" aria-hidden="true" />
            <p className="font-medium">Não foi possível carregar as informações do WhatsApp</p>
            <p className="text-sm text-muted-foreground">
              Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <MessageCircle className="w-7 h-7 text-green-500" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <Badge variant="secondary" className="text-xs font-semibold uppercase tracking-wide">
          Enterprise
        </Badge>
      </div>

      <WhatsAppContactCard
        displayPhoneNumber={data.displayPhoneNumber}
        waLink={data.waLink}
      />

      <WhatsAppUsageCard
        month={data.currentUsage.month}
        totalMessages={data.currentUsage.totalMessages}
        includedMessages={data.currentUsage.includedMessages}
        overageMessages={data.currentUsage.overageMessages}
        monthlyLimit={data.monthlyLimit}
      />
    </div>
  );
}
