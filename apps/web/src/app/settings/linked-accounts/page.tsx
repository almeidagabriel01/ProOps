"use client";

import { Link2, RefreshCw } from "lucide-react";
import {
  FormContainer,
  FormHeader,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import {
  LinkedAccountRow,
  summarizeLinkedAccounts,
} from "@/app/settings/_components/linked-account-row";
import { LinkedAccountsCardSkeleton } from "@/app/settings/_components/settings-skeleton";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { useLinkedAccounts } from "@/hooks/use-linked-accounts";
import { usePermissions } from "@/providers/permissions-provider";

export default function SettingsLinkedAccountsPage() {
  const { isDemo, isLoading: permLoading } = usePermissions();
  const enabled = !permLoading && !isDemo;
  const { accounts, isLoading, error, reload } = useLinkedAccounts(enabled);
  const loading = permLoading || (enabled && isLoading);
  useReportSettingsLoading(loading);

  // Fora do modo demo de propósito: não há conta de demonstração conectada a
  // nada, e o backend responde 402 para a conta gratuita.
  if (!permLoading && isDemo) {
    return (
      <UpgradeRequired
        feature="Contas vinculadas"
        description="Conecte o Google Agenda, o Google Drive, os pagamentos online e as notas fiscais, e acompanhe tudo o que está ligado à sua empresa num lugar só."
      />
    );
  }

  return (
    <FormContainer>
      {loading ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Contas vinculadas"
          subtitle="Tudo o que está conectado à ProOps, e o que precisa de reconexão"
          icon={Link2}
        />
      )}

      {loading ? (
        <LinkedAccountsCardSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integrações</CardTitle>
            <CardDescription data-testid="linked-accounts-summary">
              {summarizeLinkedAccounts(accounts)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {accounts.map((account) => (
                <LinkedAccountRow key={account.id} account={account} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </FormContainer>
  );
}
