"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import {
  RecoveryCodesService,
  type RecoveryCodesStatusResponse,
} from "@/services/recovery-codes-service";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RecoveryCodesModal } from "./recovery-codes-modal";

export interface RecoveryCodesSectionHandle {
  /** Current recovery-codes status (null while still loading / unknown). */
  status: RecoveryCodesStatusResponse | null;
  /** Re-reads the status from the backend. */
  refresh: () => Promise<RecoveryCodesStatusResponse | null>;
  /** Generates a fresh batch and opens the modal (used for the post-enroll auto-offer). */
  generateAndShow: () => Promise<void>;
}

/**
 * Recovery-codes panel inside the 2FA section. Shows how many codes remain and
 * lets the user generate (or regenerate) them, displaying the plaintext batch
 * once in a modal. Exposes an imperative handle so the parent can auto-offer
 * generation right after the user's first 2FA enroll.
 */
type RecoveryCodesSectionProps = Record<never, never>;

export const RecoveryCodesSection = React.forwardRef<
  RecoveryCodesSectionHandle,
  RecoveryCodesSectionProps
>(function RecoveryCodesSection(_props, ref) {
  const [status, setStatus] =
    React.useState<RecoveryCodesStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [codes, setCodes] = React.useState<string[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);

  const refresh =
    React.useCallback(async (): Promise<RecoveryCodesStatusResponse | null> => {
      try {
        const next = await RecoveryCodesService.getRecoveryCodesStatus();
        setStatus(next);
        return next;
      } catch {
        setStatus(null);
        return null;
      } finally {
        setLoading(false);
      }
    }, []);

  const generateAndShow = React.useCallback(async () => {
    setGenerating(true);
    try {
      const { codes: fresh } =
        await RecoveryCodesService.generateRecoveryCodes();
      setCodes(fresh);
      setModalOpen(true);
      await refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Não foi possível gerar os códigos. Tente novamente.";
      toast.error(message);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [refresh]);

  React.useImperativeHandle(
    ref,
    () => ({ status, refresh, generateAndShow }),
    [status, refresh, generateAndShow],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasCodes = (status?.total ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          Códigos de recuperação
        </CardTitle>
        <CardDescription>
          Códigos de uso único para entrar caso você perca o acesso ao seu
          segundo fator.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" />
            Carregando...
          </div>
        ) : hasCodes ? (
          <p className="text-sm">
            Você tem{" "}
            <span className="font-medium">{status?.remaining ?? 0}</span> de{" "}
            <span className="font-medium">{status?.total ?? 0}</span> códigos de
            recuperação não usados.
          </p>
        ) : (
          <Alert>
            <AlertTitle>Você ainda não tem códigos de recuperação</AlertTitle>
            <AlertDescription>
              Gere seus códigos para garantir o acesso à conta caso perca o
              segundo fator.
            </AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          variant={hasCodes ? "outline" : "default"}
          onClick={() => void generateAndShow()}
          disabled={generating || loading}
          className="w-fit gap-2 cursor-pointer"
        >
          {generating && <Spinner className="h-4 w-4" />}
          {generating
            ? "Gerando..."
            : hasCodes
              ? "Regenerar códigos"
              : "Gerar códigos"}
        </Button>
      </CardContent>

      <RecoveryCodesModal
        open={modalOpen}
        onOpenChange={(next) => {
          setModalOpen(next);
          if (!next) setCodes([]);
        }}
        codes={codes}
      />
    </Card>
  );
});
