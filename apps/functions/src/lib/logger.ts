type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type LogContext = Record<string, unknown>;

function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    severity: level, // GCP Cloud Logging uses "severity" as a special field
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (level === "ERROR") {
    console.error(JSON.stringify(entry));
  } else if (level === "WARN") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    log("DEBUG", message, context),
  info: (message: string, context?: LogContext) =>
    log("INFO", message, context),
  warn: (message: string, context?: LogContext) =>
    log("WARN", message, context),
  error: (message: string, context?: LogContext) =>
    log("ERROR", message, context),
};

/**
 * Registra a duracao de uma etapa e a deixa acessivel ao middleware de timeout.
 *
 * Duas saidas de proposito. O log serve para quem acompanha o terminal; o
 * `res.locals.timings` serve para quando a request ESTOURA: ali o resumo final
 * nunca chega, e as etapas ja concluidas sao a unica pista de onde travou. Foi
 * a lacuna que fez tres diagnosticos errados seguidos sobre "salvar proposta
 * esta lento".
 */
export function recordPhase(
  res: { locals?: Record<string, unknown> } | undefined,
  event: string,
  fields: Record<string, unknown> & { phase: string; ms: number },
): void {
  logger.info(event, fields);
  if (!res) return;
  const locals = (res.locals ??= {});
  const timings = (locals.timings ??= {}) as Record<string, number>;
  timings[fields.phase] = fields.ms;
}
