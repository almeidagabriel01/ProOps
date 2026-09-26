"use client";

import * as React from "react";
import {
  DEFAULT_SCENARIOS,
  type CashFlowScenario,
  type CashFlowScenarioId,
} from "@/lib/finance/cash-flow";

const STORAGE_KEY = "proops:cash-flow-scenarios";

type Scenarios = Record<CashFlowScenarioId, CashFlowScenario>;

function sanitize(value: unknown): Scenarios {
  const result = { ...DEFAULT_SCENARIOS };
  if (!value || typeof value !== "object") return result;
  for (const id of Object.keys(DEFAULT_SCENARIOS) as CashFlowScenarioId[]) {
    const raw = (value as Record<string, Partial<CashFlowScenario>>)[id];
    const rate = Number(raw?.receiveRate);
    const delay = Number(raw?.delayDays);
    if (Number.isFinite(rate) && Number.isFinite(delay)) {
      result[id] = {
        receiveRate: Math.min(Math.max(Math.round(rate), 0), 100),
        delayDays: Math.min(Math.max(Math.round(delay), 0), 365),
      };
    }
  }
  return result;
}

function read(): Scenarios {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : DEFAULT_SCENARIOS;
  } catch {
    return DEFAULT_SCENARIOS;
  }
}

/**
 * Os três cenários, com o ajuste que a pessoa fez guardado no navegador dela:
 * é uma conveniência de quem olha, não um dado da empresa.
 */
export function useCashFlowScenarios() {
  const [scenarios, setScenarios] = React.useState<Scenarios>(DEFAULT_SCENARIOS);

  React.useEffect(() => {
    setScenarios(read());
  }, []);

  const update = React.useCallback((id: CashFlowScenarioId, patch: Partial<CashFlowScenario>) => {
    setScenarios((current) => {
      const next = sanitize({ ...current, [id]: { ...current[id], ...patch } });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Navegador sem armazenamento: vale só nesta visita.
      }
      return next;
    });
  }, []);

  const reset = React.useCallback((id: CashFlowScenarioId) => {
    update(id, DEFAULT_SCENARIOS[id]);
  }, [update]);

  return { scenarios, update, reset };
}
