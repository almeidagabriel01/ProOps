import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { logger } from "../lib/logger";

/**
 * Rastro de uma conversa com a Lia — um documento por turno.
 *
 * O `usage-tracker` conta mensagens e tokens (é o que cobra o plano), mas não
 * registra NADA sobre o que aconteceu no turno: qual ferramenta rodou, se
 * falhou, quanto demorou, qual provider serviu. Sem isso, "a Lia errou" não
 * tem o que investigar e não existe base para decidir sobre prompt ou modelo.
 *
 * PRIVACIDADE — o que este módulo grava é deliberadamente restrito:
 * grava-se o NOME da ferramenta, nunca os argumentos. Os args carregam nome de
 * cliente, descrição de proposta, valor e CPF; o mesmo vale para a mensagem do
 * usuário e a resposta do modelo, das quais só o tamanho é persistido. Não
 * afrouxar isso sem revisar a política de dados — a coleção existe para
 * responder "o que quebrou", não "o que o cliente digitou".
 *
 * CLOUD RUN — por que o `finish` é aguardado: a CPU só é alocada DURANTE o
 * processamento da request (não existe `cpu-throttling=false` no serviço). Uma
 * escrita disparada sem `await` depois do `res.end()` fica pendente quando o
 * handler retorna, a instância congela e a escrita se perde — sem erro, porque
 * o próprio `.catch()` não chega a rodar. Foi exatamente o que aconteceu no
 * primeiro teste em dev: a Lia respondeu e nenhum trace apareceu. Por isso
 * `finish` devolve Promise e o chamador aguarda: a resposta já foi enviada,
 * então isso não adiciona latência para o usuário — só mantém a instância viva
 * até a escrita terminar.
 *
 * Retenção: `expiresAt` é um Timestamp para a TTL policy nativa do Firestore
 * (sem cron, sem leitura de varredura). Habilitar por ambiente com:
 *   gcloud firestore fields ttls update expiresAt \
 *     --collection-group=ai_traces --enable-ttl --project=<projeto>
 * Enquanto a policy não existe os docs só acumulam — no volume atual
 * (teto de 1200 mensagens/mês no plano mais alto) isso é irrelevante.
 */

export const AI_TRACES_COLLECTION = "ai_traces";
const RETENTION_DAYS = 30;
/** Teto de ferramentas registradas por turno — o loop já limita a 5 rounds x 10 calls. */
const MAX_TOOLS_RECORDED = 50;

export type AiTraceStatus = "ok" | "error" | "confirmation_pending";

interface AiToolTrace {
  name: string;
  ok: boolean;
  ms: number;
}

export interface AiTraceInput {
  tenantId: string;
  uid: string;
  sessionId?: string;
  planTier: string;
  promptChars: number;
}

export interface AiTraceFinishInput {
  status: AiTraceStatus;
  provider: string;
  modelName: string;
  totalTokens: number;
  responseChars: number;
  errorCode?: string;
}

export interface AiTraceRecorder {
  recordTool: (name: string, ok: boolean, ms: number) => void;
  /** Resolve só depois que a escrita termina. Nunca rejeita. */
  finish: (input: AiTraceFinishInput) => Promise<void>;
}

/**
 * Abre um rastro. A escrita acontece uma única vez, no `finish`, e falha de
 * observabilidade nunca derruba o stream — o erro é logado, não propagado.
 * Não chamar `finish` simplesmente não grava nada.
 */
export function startAiTrace(input: AiTraceInput): AiTraceRecorder {
  const startedAt = Date.now();
  const tools: AiToolTrace[] = [];
  let finished = false;

  return {
    recordTool(name, ok, ms) {
      if (tools.length >= MAX_TOOLS_RECORDED) return;
      tools.push({ name, ok, ms: Math.max(0, Math.round(ms)) });
    },

    async finish(result) {
      if (finished) return;
      finished = true;

      const now = Date.now();
      const doc = {
        tenantId: input.tenantId,
        uid: input.uid,
        sessionId: input.sessionId || null,
        planTier: input.planTier,
        provider: result.provider,
        modelName: result.modelName,
        status: result.status,
        errorCode: result.errorCode || null,
        totalTokens: result.totalTokens,
        promptChars: input.promptChars,
        responseChars: result.responseChars,
        latencyMs: now - startedAt,
        toolCount: tools.length,
        toolsFailed: tools.filter((t) => !t.ok).length,
        tools,
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + RETENTION_DAYS * 86_400_000),
      };

      try {
        await db.collection(AI_TRACES_COLLECTION).add(doc);
      } catch (err) {
        logger.warn("ai_trace write failed", {
          tenantId: input.tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
