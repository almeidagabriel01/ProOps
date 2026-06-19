"use client";

import { useEffect } from "react";
import { installClientErrorReporter } from "@/lib/observability/client-error-reporter";

export function ErrorReporterInstaller(): null {
  useEffect(() => {
    const uninstall = installClientErrorReporter();
    return uninstall;
  }, []);
  return null;
}
