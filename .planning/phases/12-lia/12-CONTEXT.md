# 12-CONTEXT — Lia: Decisões de Design

> Registra todas as decisões de arquitetura tomadas antes da implementação.
> Não alterar decisões fechadas sem discussão explícita.

---

## Identidade da assistente

**Nome:** Lia  
**Personalidade:** Prestativa, direta, profissional. Parte da equipe do usuário — não um chatbot genérico.  
**Idioma:** Sempre português brasileiro, mesmo que o usuário escreva em outro idioma.  
**Avatar:** Iniciais "LI" com cor primária do tenant (fallback: cor padrão da marca ProOps).

---

## Decisões fechadas

### 1. Modelo por plano

| Plano | Modelo | Limite | Justificativa |
|---|---|---|---|
| Free | — | 0 msg | Sem acesso. Pressão de upgrade. |
| Starter | `gemini-2.0-flash` | 80 msg/mês | Tarefas simples, módulos limitados. |
| Pro | `gemini-2.5-flash` | 400 msg/mês | Módulos cruzados, raciocínio melhor. |
| Enterprise | `gemini-2.5-flash` (80%) + `gemini-2.5-pro` (20%) | 2.000 msg/mês | Roteamento por complexidade. |

**Roteamento Enterprise** — keywords que disparam o modelo Pro:
```
relatório analítico, comparar meses, analisar tendência,
whatsapp em massa, exportar todos, histórico completo,
projeção, evolução ao longo, comparativo, consolidado
```

### 2. Período de limite: Mensal

**Decisão:** Limite mensal, não diário nem semanal.  
**Justificativa:** Alinha com o ciclo de billing (Stripe), o usuário entende naturalmente, permite uso concentrado em dias de pico (ex: fechamento de propostas) sem frustração.  
**Reset:** Documento Firestore por mês (`aiUsage/YYYY-MM`). Reset automático pela troca de documento — sem cron de reset de dados.

### 3. Histórico de conversa

**Starter:** Apenas memória de sessão (estado no frontend). Sem persistência Firestore.  
**Pro / Enterprise:** Persiste em `tenants/{tenantId}/aiConversations/{sessionId}`. Histórico das últimas 10 mensagens enviadas ao modelo (controle de custo de contexto).  
**Justificativa:** Diferencial real entre planos. Pro/Enterprise "lembram" conversas anteriores.

### 4. Confirmação antes de ações destrutivas

**Decisão:** Qualquer DELETE ou edição em massa (>10 registros) exige:
1. Lia chama tool `request_confirmation` com resumo da ação.
2. Frontend exibe modal com registros afetados e severidade.
3. Usuário confirma → frontend reenvia com `confirmed: true`.
4. Só então o handler executa.

**Nunca deletar sem esse handshake**, mesmo que o usuário escreva "pode deletar sem perguntar".

### 5. Posicionamento do chat no frontend

**Decisão:** Painel lateral deslizável (`<aside>`), fixo na direita, largura 420px.  
**Justificativa:** Não interrompe o fluxo do ERP. O usuário continua vendo a página atual enquanto conversa com a Lia.  
**Alternativa descartada:** Página separada `/ai` — quebra o contexto de trabalho.

### 6. Streaming

**Decisão:** Server-Sent Events (SSE) via Cloud Function HTTP com `Content-Type: text/event-stream`.  
**Frontend:** `fetch` com `ReadableStream` (não `EventSource`, pois precisa de POST com body).  
**Fallback:** Se streaming falhar, resposta completa em JSON (timeout 60s).

### 7. Segurança das tools

**Decisão:** `buildAvailableTools()` filtra as tools **antes** de enviá-las ao modelo. O modelo nunca "vê" tools de módulos inativos.  
**Validação dupla:** O executor de tools também valida módulo + role antes de executar, mesmo que o modelo chame uma tool que não deveria ter.  
**tenantId:** Nunca aceito como parâmetro do usuário ou do modelo. Sempre vem do token de auth.

### 8. Custo estimado (pior cenário por tenant/mês)

Estimativa com ~4.850 tokens médios por mensagem:

| Plano | Custo |
|---|---|
| Starter | ~R$ 0,70 |
| Pro | ~R$ 5,20 |
| Enterprise | ~R$ 82 |

**Alerta de custo:** Se tenant Enterprise ultrapassar $15 USD/mês → notificação para Gabriel.

---

## Decisões em aberto

Todas as decisões foram fechadas na Fase 1 (pesquisa de codebase).

---

## Decisões fechadas (adicionadas na Fase 1)

### 9. Sugestões contextuais

**Decisão:** Sim, implementar sugestões contextuais baseadas na página atual.
**Mecanismo:** `usePathname()` do Next.js já está disponível no `TenantProvider` (linha 18: `import { usePathname } from "next/navigation"`). O `LiaPanel` pode usar o mesmo hook sem custo adicional.
**Implementação:** Passar `currentPath` como contexto adicional no system prompt via `buildSystemPrompt()`. A Lia recebe o path e adapta sugestões de abertura (ex: na rota `/proposals`, sugerir "Criar nova proposta" ou "Listar propostas recentes").
**Justificativa:** O codebase já usa `usePathname()` extensivamente. Custo de implementação baixo, valor alto para o usuário (reduz atrito de onboarding com a Lia).
**Escopo:** Apenas o path atual — não rastrear histórico de navegação. Atualiza automaticamente quando o usuário navega (rerender do painel).

### 10. Notificação de limite mensal

**Decisão:** In-app apenas (sem email). Notificação visual proativa quando atingir 80% do limite.
**Mecanismo:** O `LiaUsageBadge` muda de cor quando `messagesUsed / messagesLimit >= 0.8`. Ao tentar enviar mensagem com limite esgotado (100%), o input é desabilitado com tooltip mostrando a data de reset.
**Justificativa:** Email neste contexto seria ruído — o usuário já está na plataforma ao interagir com a Lia. Notificação in-app é suficiente e imediata. Email pode ser adicionado em uma fase posterior se feedback de usuários indicar necessidade.
**Alternativa descartada:** Email ao atingir 80% — intrusivo para uma feature de uso diário dentro da plataforma.

### 11. Exportação de conversa

**Decisão:** Não implementar exportação de conversa em PDF neste milestone.
**Justificativa:** O sistema de geração de PDF já usa Playwright/Chromium headless (alto custo de CPU, rate-limitado em 5 req/60s por usuário). Adicionar exportação de chat ao mesmo pipeline aumenta a pressão sobre o rate limit. A feature tem valor secundário comparado com a funcionalidade core da Lia. Pode ser adicionada como addon em v3.1 se houver demanda.
**Alternativa futura:** Exportação como CSV/JSON (simples, sem Playwright) poderia ser implementada como endpoint leve. Não bloqueia o milestone atual.

---

## Schemas Firestore (validados na Fase 1)

### `AiUsageDocument`

Subcoleção: `tenants/{tenantId}/aiUsage/{YYYY-MM}`

```typescript
interface AiUsageDocument {
  tenantId: string;
  month: string;               // "YYYY-MM"
  messagesUsed: number;        // incrementado com FieldValue.increment(1)
  totalTokensUsed: number;     // incrementado com FieldValue.increment(tokens)
  lastUpdatedAt: Timestamp;
}
```

**Regra de reset:** Não há cron de reset. O documento `YYYY-MM` do mês anterior simplesmente deixa de ser consultado quando o mês vira. Novos documentos são criados com `{ merge: true }` no primeiro uso do mês.

**Validação de conflito:** Nenhum documento com este path existe no codebase atual. O padrão é consistente com `tenant_usage/{tenantId}/months/{YYYY-MM}` já em uso.

---

### `AiConversationDocument`

Subcoleção: `tenants/{tenantId}/aiConversations/{sessionId}`

```typescript
interface AiConversationMessage {
  role: 'user' | 'model';
  content: string;             // texto da mensagem ou JSON de tool result
  timestamp: Timestamp;
}

interface AiConversationDocument {
  sessionId: string;           // gerado no cliente (uuid v4)
  uid: string;                 // Firebase Auth UID do usuário
  tenantId: string;
  messages: AiConversationMessage[];  // limitado às últimas 10 trocas (20 mensagens)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Planos com persistência:** Pro e Enterprise apenas. Para Starter, o frontend mantém o histórico apenas em memória (array no estado do `useAiChat`).

**Validação de conflito:** Nenhum documento com este path existe no codebase atual.