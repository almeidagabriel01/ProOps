"use client";

import { useProposalFormCore } from "./useProposalForm.core";
import type {
  UseProposalFormProps,
  UseProposalFormReturn,
} from "./useProposalForm.types";

export type { UseProposalFormProps, UseProposalFormReturn } from "./useProposalForm.types";

export function useProposalForm(
  props: UseProposalFormProps,
): UseProposalFormReturn {
  return useProposalFormCore(props);
}
