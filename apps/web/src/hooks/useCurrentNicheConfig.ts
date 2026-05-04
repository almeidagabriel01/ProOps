"use client";

import * as React from "react";
import { useTenant } from "@/providers/tenant-provider";
import { getNicheConfig } from "@/lib/niches/config";

export function useCurrentNicheConfig() {
  const { tenant } = useTenant();

  return React.useMemo(() => getNicheConfig(tenant?.niche), [tenant?.niche]);
}
