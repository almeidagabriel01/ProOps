"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  FileText,
  FileDown,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SharedTransactionService } from "@/services/shared-transaction-service";
import { Transaction } from "@/services/transaction-service";
import { Tenant } from "@/types";
import { TransactionPdfViewer } from "@/components/pdf/transaction-pdf-viewer";
import Image from "next/image";

import { useTransactionPdfGenerator } from "@/components/features/financial/pdf/use-transaction-pdf-generator";

export default function SharedTransactionPage() {
  const params = useParams();
  const token = params.token as string;

  const [transaction, setTransaction] = React.useState<Transaction | null>(
    null,
  );
  const [relatedTransactions, setRelatedTransactions] = React.useState<
    Transaction[]
  >([]);
  const [tenant, setTenant] = React.useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = React.useState(1);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = React.useState(0);

  const { isGenerating, handleGenerate } = useTransactionPdfGenerator({
    transaction: transaction || ({} as Transaction),
    relatedTransactions,
    tenant,
  });

  React.useEffect(() => {
    // Auto-fit PDF on mobile screens initially and on resize
    const handleResize = () => {
      if (window.innerWidth < 850) {
        // Leave some margin (32px) around the 794px A4 width
        const scale = Math.max(0.2, (window.innerWidth - 32) / 794);
        setPreviewZoom(scale);
      } else {
        setPreviewZoom(1);
      }
    };

    // Set initial size
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.contentRect.height);
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [transaction, relatedTransactions]);

  React.useEffect(() => {
    const loadSharedTransaction = async () => {
      if (!token) {
        setError("Token inválido");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await SharedTransactionService.getSharedTransaction(token);
        setTransaction(data.transaction);
        setRelatedTransactions(data.relatedTransactions || []);
        setTenant(data.tenant as Tenant);
      } catch (err: unknown) {
        console.error("Error loading shared transaction:", err);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorAny = err as any;

        if (
          errorAny?.message?.includes("410") ||
          errorAny?.response?.data?.code === "EXPIRED_LINK"
        ) {
          setError("Este link expirou. Solicite um novo link ao responsável.");
        } else if (errorAny?.message?.includes("404")) {
          setError("Link inválido ou lançamento não encontrado.");
        } else {
          setError("Erro ao carregar lançamento. Tente novamente mais tarde.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSharedTransaction();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando lançamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>Lançamento não encontrado</AlertTitle>
              <AlertDescription>
                Não foi possível localizar este lançamento financeiro.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header simplificado com branding do tenant */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              {tenant?.logoUrl && (
                <Image
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  width={40}
                  height={40}
                  className="h-10 w-auto object-contain shrink-0 rounded-md"
                />
              )}
              <div className="min-w-0 pr-2">
                <h1 className="text-base md:text-lg font-bold truncate leading-tight text-foreground">
                  {tenant?.name || "Lançamento Financeiro"}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground truncate">
                  Visualização de Recibo
                </p>
              </div>
            </div>

            <button
              type="button"
              className="md:hidden shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md shadow-md flex-none transition-all cursor-pointer hover:opacity-90 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              style={
                tenant?.primaryColor
                  ? {
                      backgroundColor: tenant.primaryColor,
                      color: "#ffffff",
                      borderColor: tenant.primaryColor,
                    }
                  : {
                      backgroundColor: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                    }
              }
              onClick={() => handleGenerate(undefined, "shared")}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Baixar PDF
            </button>
          </div>

          <div className="w-full md:flex-1 md:text-right flex flex-col md:items-end justify-center min-w-0 border-t md:border-t-0 pt-3 md:pt-0 md:pr-4">
            <p className="font-semibold text-sm md:text-base leading-snug w-full truncate text-foreground">
              {transaction.description || "Lançamento"}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground w-full truncate">
              {transaction.clientName || "Cliente não informado"}
            </p>
          </div>

          <button
            type="button"
            className="hidden md:inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold transition-all shadow-sm border border-transparent cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            style={
              tenant?.primaryColor
                ? {
                    backgroundColor: tenant.primaryColor,
                    color: "#ffffff",
                    borderColor: tenant.primaryColor,
                  }
                : {
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }
            }
            onClick={() => handleGenerate(undefined, "shared")}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Baixar PDF
          </button>
        </div>
      </header>

      {/* PDF View Area */}
      <main className="flex-1 w-full bg-muted/20 overflow-hidden flex flex-col relative">
        <div className="container mx-auto px-4 py-4 w-full flex justify-center">
          <div className="w-full max-w-[794px] flex items-center justify-between bg-card border rounded-lg p-2 shadow-sm z-10">
            <span className="text-sm font-medium text-muted-foreground px-2">
              Visualização do Recibo
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors cursor-pointer"
                onClick={() => setPreviewZoom((z) => Math.max(0.2, z - 0.1))}
                title="Diminuir zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground w-12 text-center select-none block">
                {Math.round(previewZoom * 100)}%
              </span>
              <button
                type="button"
                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors cursor-pointer"
                onClick={() => setPreviewZoom((z) => Math.min(2, z + 0.1))}
                title="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full flex-1 overflow-auto px-4 sm:px-8 pb-32 pt-4 flex justify-center">
          <div
            id="shared-transaction-preview-content"
            ref={contentRef}
            className="mx-auto origin-top transition-transform duration-200"
            style={{
              width: "794px",
              minHeight: "1123px", // A4 Ratio
              transform: `scale(${previewZoom})`,
              marginBottom: contentHeight
                ? `-${contentHeight * (1 - previewZoom)}px`
                : undefined,
            }}
          >
            <TransactionPdfViewer
              transaction={transaction}
              relatedTransactions={relatedTransactions}
              tenant={tenant}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
