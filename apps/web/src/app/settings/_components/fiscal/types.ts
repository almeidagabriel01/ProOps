import type { FiscalAddress } from "@/services/fiscal-service";
import type { FiscalFormState } from "@/lib/fiscal/settings-payload";

export type SetFiscalField = <K extends keyof FiscalFormState>(
  key: K,
  value: FiscalFormState[K],
) => void;

export type SetFiscalAddress = <K extends keyof FiscalAddress>(
  key: K,
  value: FiscalAddress[K],
) => void;

/** Erros por campo do passo atual — a chave é o nome do campo do formulário. */
export type FiscalErrors = Record<string, string>;
