"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle } from "lucide-react";
import { PhoneVerificationDialog } from "./PhoneVerificationDialog";

interface WhatsAppBotCardProps {
  /** Número de telefone do perfil do usuário (para pré-preencher no modal) */
  userPhoneNumber?: string;
}

/**
 * Exibe o cartão de integração do Bot do WhatsApp.
 * Inclui o número oficial do bot (por ambiente) e o status de verificação
 * do telefone do usuário, com botão para verificação sob demanda.
 */
export function WhatsAppBotCard({
  userPhoneNumber = "",
}: WhatsAppBotCardProps) {
  const [botNumber, setBotNumber] = useState("+1 (555) 152-2865");
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  useEffect(() => {
    // Determina o número do bot com base no ambiente
    const host = window.location.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.includes("vercel.app")
    ) {
      setBotNumber("+1 (555) 152-2865");
    } else {
      setBotNumber("+55 (35) 98421-9483");
    }

    // Verifica se o usuário tem telefone verificado no Firebase Auth
    setIsPhoneVerified(!!auth.currentUser?.phoneNumber);

    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setIsPhoneVerified(!!firebaseUser?.phoneNumber);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <Card className="border-green-500/20 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent p-6 border-b border-green-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-green-600"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg text-green-700 dark:text-green-500">
                Bot do WhatsApp
              </CardTitle>
              <CardDescription className="text-green-600/70 dark:text-green-400/70">
                Status da integração de mensagens automáticas
              </CardDescription>
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border bg-card">
            <div>
              <p className="font-semibold text-lg flex items-center gap-2">
                Número Oficial:{" "}
                <span className="text-primary">{botNumber}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Este é o número que entregará as propostas e notificações para
                os seus clientes. <strong>Dica:</strong> Avise seus clientes
                para adicionarem esse número aos contatos para que os links
                enviados sejam clicáveis imediatamente!
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge
                className={
                  isPhoneVerified
                    ? "bg-green-500/10 text-green-600 border-green-500/20 whitespace-nowrap"
                    : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 whitespace-nowrap"
                }
              >
                {isPhoneVerified ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Telefone Verificado
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Pendente de Verificação
                  </>
                )}
              </Badge>

              {!isPhoneVerified && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsVerifyModalOpen(true)}
                >
                  Verificar Telefone
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <PhoneVerificationDialog
        open={isVerifyModalOpen}
        onOpenChange={setIsVerifyModalOpen}
        onSuccess={() => setIsPhoneVerified(true)}
        initialPhoneNumber={userPhoneNumber}
      />
    </>
  );
}
