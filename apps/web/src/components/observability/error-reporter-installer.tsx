"use client";

import { useEffect } from "react";
import { installClientErrorReporter } from "@/lib/observability/client-error-reporter";
import { installChunkErrorRecovery } from "@/lib/observability/chunk-error-recovery";

export function ErrorReporterInstaller(): null {
  useEffect(() => {
    // reporter first: its listeners run before recovery reloads the page,
    // so the chunk error is still captured (flushed via beacon on pagehide)
    const uninstallReporter = installClientErrorReporter();
    const uninstallRecovery = installChunkErrorRecovery();
    return () => {
      uninstallRecovery();
      uninstallReporter();
    };
  }, []);
  return null;
}
