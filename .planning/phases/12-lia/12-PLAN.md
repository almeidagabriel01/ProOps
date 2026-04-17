# 12-PLAN — Lia: Plano de Execução

> **Milestone:** v3.0 AI Assistant  
> **Feature:** Lia — Assistente de IA nativa do ProOps  
> **Developer:** Gabriel (solo)  
> **Status:** Planejamento

---

## Arquivos deste milestone

| Arquivo | Conteúdo |
|---|---|
| `12-CONTEXT.md` | Decisões de design e arquitetura |
| `12-RESEARCH.md` | Mapeamento do codebase — preencher na Fase 1 |
| `12-LIA-PROMPT.md` | Template completo do system prompt da Lia |
| `12-TOOLS.md` | Definições de todas as tools com schemas |
| `12-PLAN.md` | Este arquivo — plano de execução por fase |

---

## Visão geral das fases

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Fase 1     │ →  │   Fase 2     │ →  │   Fase 3     │
│ Arquitetura  │    │ Backend Core │    │ Tool System  │
│   1 dia      │    │   2–3 dias   │    │   2–3 dias   │
└──────────────┘    └──────────────┘    └──────────────┘
                                               ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Fase 6     │ ←  │   Fase 5     │ ←  │   Fase 4     │
│ Testes & QA  │    │ Segurança &  │    │  Frontend    │
│   1–2 dias   │    │   Billing    │    │   Chat UI    │
│              │    │    1 dia     │    │   2–3 dias   │
└──────────────┘    └──────────────┘    └──────────────┘

Total estimado: 9–13 dias
```

**Importante:** A Fase 5 (Segurança) é executada antes da Fase 4 (Frontend). O backend precisa estar seguro antes de expor a interface.

---

## Fase 1 — Arquitetura & Pesquisa

**Skill:** `superpowers@superpowers-dev`  
**Duração:** 1 dia  
**Pré-requisito:** Nenhum

### O que fazer
- Ler todos os arquivos listados em `12-RESEARCH.md`
- Preencher a seção "Achados" do `12-RESEARCH.md` com os resultados reais
- Fechar as decisões em aberto do `12-CONTEXT.md`
- Validar se o schema Firestore proposto conflita com o que existe

### Deliverables
- [ ] `12-RESEARCH.md` preenchido com achados reais do codebase
- [ ] `12-CONTEXT.md` com decisões em aberto fechadas
- [ ] Schema TypeScript validado de `AiUsageDocument` e `AiConversationDocument`
- [ ] Decisão final sobre a estrutura de subcoleção do Firestore

### Critério de conclusão
`12-RESEARCH.md` está completamente preenchido e não há decisões em aberto no `12-CONTEXT.md`.

---

## Fase 2 — Backend Core: AI Engine

**Skill:** `superpowers@superpowers-dev`  
**Duração:** 2–3 dias  
**Pré-requisito:** Fase 1 concluída

### Arquivos a criar

```
functions/src/ai/
├── index.ts
├── chat.function.ts
├── context-builder.ts
├── model-router.ts
├── usage-tracker.ts
└── conversation-store.ts
```

### Checklist de implementação

**`chat.function.ts`**
- [ ] Cloud Function HTTP com SSE (`Content-Type: text/event-stream`)
- [ ] Integração com `aiAuthMiddleware` (Fase 5 — criar stub temporário)
- [ ] Chamada ao `buildSystemPrompt()`
- [ ] Chamada ao `buildAvailableTools()`
- [ ] Streaming do Gemini → SSE para o cliente
- [ ] Processamento de tool calls no loop de streaming
- [ ] Chamada ao `incrementAiUsage()` após conclusão
- [ ] Tratamento de erro com fallback para resposta não-streaming

**`context-builder.ts`**
- [ ] `buildSystemPrompt()` gerando o template completo de `12-LIA-PROMPT.md`
- [ ] `buildModuleList()` com todos os módulos do sistema
- [ ] `buildLimitsSection()` com valores reais do Firestore
- [ ] `buildPermissionMatrix()` por módulo + role
- [ ] `buildToolDefinitions()` filtrando por módulo + role

**`model-router.ts`**
- [ ] `selectModel()` retornando o modelo correto por `planId`
- [ ] Detecção de complexidade para roteamento Enterprise (keywords de `12-CONTEXT.md`)
- [ ] Throw se `planId === 'free'`

**`usage-tracker.ts`**
- [ ] `checkAiLimit()` — consulta e lança 429 se estourou
- [ ] `incrementAiUsage()` — incremento atômico com `FieldValue.increment`
- [ ] `getAiUsage()` — leitura do documento mensal `YYYY-MM`
- [ ] Cloud Function Scheduler para limpeza de documentos antigos (>3 meses)

**`conversation-store.ts`**
- [ ] `saveConversation()` — persist para Pro/Enterprise
- [ ] `loadConversation()` — carrega histórico com limite de turnos
- [ ] Sem persistência para Starter (retorna array vazio)

**Regras Firestore**
- [ ] `tenants/{tenantId}/aiUsage/{month}` — read: tenant autenticado, write: false
- [ ] `tenants/{tenantId}/aiConversations/{sessionId}` — read/write: uid === resource.data.uid

**Variáveis de ambiente**
- [ ] `GEMINI_API_KEY` adicionada em `functions/.env`
- [ ] `GEMINI_API_KEY=fake-key` adicionada em `functions/.env.demo-proops-test`
- [ ] Secrets adicionados no GitHub (staging e production environments)

### Critério de conclusão
Testar via `curl` ou Postman com emuladores rodando: enviar uma mensagem e receber streaming SSE com resposta da Lia.

---

## Fase 3 — Tool System

**Skill:** `superpowers@superpowers-dev`  
**Duração:** 2–3 dias  
**Pré-requisito:** Fase 2 concluída

### Arquivos a criar

```
functions/src/ai/tools/
├── index.ts           # buildAvailableTools() + registry
├── definitions.ts     # todas as ToolDefinition (já documentadas em 12-TOOLS.md)
├── schemas.ts         # Zod schemas por tool
└── executor.ts        # executeToolCall() + handlers por tool
```

### Checklist de implementação

**`definitions.ts`**
- [ ] Implementar todas as tools documentadas em `12-TOOLS.md`
- [ ] Garantir que descriptions sejam claras o suficiente para o modelo não confundir tools

**`schemas.ts`**
- [ ] Schema Zod para cada tool que modifica dados (create, update, delete, transfer)
- [ ] Schemas de leitura são mais permissivos (sem required rígido)

**`executor.ts`**
- [ ] `executeToolCall()` — dispatcher principal
- [ ] Validação dupla: módulo ativo + role antes de executar
- [ ] Handler para cada tool chamando o service correspondente
- [ ] Handler `request_confirmation` retorna objeto para o frontend exibir o dialog
- [ ] Handler `delete_*` verifica `confirmed === true` antes de executar
- [ ] Log estruturado de cada tool call executada

**`index.ts`**
- [ ] `buildAvailableTools()` com toda a lógica de filtro por módulo + role + planId (documentada em `12-CONTEXT.md`)

### Critério de conclusão
- [ ] Criar uma proposta via Lia (usando emuladores)
- [ ] Tentar criar uma transação com módulo financeiro inativo — Lia deve recusar
- [ ] Tentar deletar um contato — dialog de confirmação deve aparecer

---

## Fase 4 — Frontend: Chat UI

**Skills:** `frontend-design@claude-plugins-official` · `ui-ux-pro-max@ui-ux-pro-max-skill`  
**Duração:** 2–3 dias  
**Pré-requisito:** Fase 3 concluída (backend funcionando com emuladores)

### Arquivos a criar

```
src/
├── components/ai/
│   ├── LiaPanel.tsx
│   ├── LiaChatWindow.tsx
│   ├── LiaMessageBubble.tsx
│   ├── LiaInputBar.tsx
│   ├── LiaToolConfirmDialog.tsx
│   ├── LiaToolResultCard.tsx
│   ├── LiaUsageBadge.tsx
│   └── LiaTriggerButton.tsx
└── hooks/
    └── useAiChat.ts
```

### Checklist de implementação

**`useAiChat.ts`**
- [ ] `send()` com fetch + ReadableStream (SSE parsing)
- [ ] Estado de streaming (`isStreaming`)
- [ ] Atualização incremental da bolha de resposta durante streaming
- [ ] Detecção de evento `tool_result.requiresConfirmation` → `setPendingConfirmation`
- [ ] Reenvio com `confirmed: true` ao confirmar

**`LiaPanel.tsx`**
- [ ] Painel lateral `<aside>` com `position: fixed`, `right: 0`, `width: 420px`
- [ ] Animação de slide in/out com Tailwind transition
- [ ] Não renderiza se `planId === 'free'`
- [ ] Header com avatar "LI", nome "Lia", subtitle "Assistente ProOps" e `LiaUsageBadge`

**`LiaChatWindow.tsx`**
- [ ] Scroll automático para o fim ao receber nova mensagem
- [ ] Indicador "Lia está digitando..." com animação de 3 pontos durante streaming
- [ ] Separador de data entre mensagens de dias diferentes

**`LiaMessageBubble.tsx`**
- [ ] Bolha do usuário (direita) vs Lia (esquerda com avatar)
- [ ] Markdown rendering para respostas da Lia
- [ ] Timestamp na hover

**`LiaToolResultCard.tsx`**
- [ ] Card compacto mostrando: nome da tool executada + resumo do resultado
- [ ] Expandível para ver detalhes (ex: lista completa de registros retornados)

**`LiaToolConfirmDialog.tsx`**
- [ ] Modal com: descrição da ação, lista de registros afetados, severidade visual
- [ ] Botão "Cancelar" e "Confirmar" (destructive se severity === 'high')
- [ ] Não fechar ao clicar fora (ação destrutiva precisa de decisão explícita)

**`LiaTriggerButton.tsx`**
- [ ] Botão flutuante no canto inferior direito
- [ ] Badge de notificação se houver resposta não lida

**Layout**
- [ ] Injetar `<LiaPanel />` em `src/app/(dashboard)/layout.tsx`
- [ ] Garantir que o painel não conflite com outros elementos fixos

**Acessibilidade**
- [ ] `aria-label` no trigger button
- [ ] `role="log"` na área de mensagens
- [ ] Foco no input ao abrir o painel

### Critério de conclusão
- [ ] Fluxo completo: abrir painel → enviar mensagem → ver streaming → fechar painel
- [ ] Fluxo de delete: pedir delete → ver dialog → cancelar → pedir novamente → confirmar → ver confirmação
- [ ] Badge de uso atualiza após envio

---

## Fase 5 — Segurança & Billing Integration

**Skill:** `superpowers@superpowers-dev`  
**Duração:** 1 dia  
**Pré-requisito:** Fase 2 concluída

### Arquivos a criar/editar

```
functions/src/api/middleware/ai-auth.middleware.ts   (novo)
firestore.rules                                       (editar)
src/app/(dashboard)/billing/page.tsx                  (editar — adicionar uso de IA)
```

### Checklist de implementação

**`ai-auth.middleware.ts`**
- [ ] Reutilizar `validateFirebaseToken()` existente
- [ ] Bloquear `planId === 'free'` com 403 e mensagem de upgrade
- [ ] Bloquear `subscriptionStatus !== 'active'` com 403
- [ ] Verificar limite de mensagens com `checkAiLimit()` — bloquear ANTES de iniciar o stream
- [ ] Retornar `resetAt` no body do 429 para o frontend exibir

**Constante `AI_LIMITS`**
- [ ] `starter: { messagesPerMonth: 80, model: 'gemini-2.0-flash' }`
- [ ] `pro: { messagesPerMonth: 400, model: 'gemini-2.5-flash-preview-05-20' }`
- [ ] `enterprise: { messagesPerMonth: 2000, model: 'gemini-2.5-flash-preview-05-20' }`

**`firestore.rules`**
- [ ] Regra para `aiUsage/{month}` — read: tenant autenticado, write: false
- [ ] Regra para `aiConversations/{sessionId}` — isolado por uid

**Página de billing**
- [ ] Seção "Uso da Lia" mostrando `messagesUsed / messagesPerMonth` com barra de progresso
- [ ] Data de reset formatada em português

**Alerta de custo (Enterprise)**
- [ ] Cloud Function que monitora uso de tokens e envia email se > $15 USD/mês

### Critério de conclusão
- [ ] Tenant Free tenta usar a IA → recebe 403
- [ ] Tenant Starter usa 80 mensagens → 81ª mensagem recebe 429 com `resetAt`
- [ ] Uso aparece corretamente na página de billing

---

## Fase 6 — Testes & QA

**Skill:** `skillx@skillx-marketplace`  
**Duração:** 1–2 dias  
**Pré-requisito:** Fases 2–5 concluídas

### Arquivos a criar

```
e2e/ai/
├── lia-access.spec.ts         # AI-01 a AI-03
├── lia-tools.spec.ts          # AI-04 a AI-07
├── lia-limits.spec.ts         # AI-08 a AI-09
├── lia-permissions.spec.ts    # AI-10 a AI-11
└── lia-confirmations.spec.ts  # AI-12
```

### Casos de teste E2E

| ID | Cenário | Tenant | Resultado esperado |
|---|---|---|---|
| AI-01 | Plano Free não vê o botão da Lia | beta (free) | Trigger button não existe no DOM |
| AI-02 | Starter tem badge "X / 80" | novo tenant starter | Badge visível com limite correto |
| AI-03 | Pro tem badge "X / 400" | admin@alpha (pro) | Badge visível com limite correto |
| AI-04 | Criar proposta via Lia | admin@alpha | Proposta aparece na lista após conversa |
| AI-05 | Buscar clientes via Lia | admin@alpha | Lia lista clientes do tenant |
| AI-06 | Módulo inativo — Lia recusa | starter sem financial | Lia explica que módulo está inativo |
| AI-07 | Limite de propostas atingido | tenant com limite cheio | Lia informa limite e sugere upgrade |
| AI-08 | Limite de mensagens atingido | tenant com 80/80 | Input desabilitado com data de reset |
| AI-09 | Reset mensal funciona | — | Contador zerado no primeiro do mês |
| AI-10 | Isolamento cross-tenant | admin@alpha | Lia não acessa dados do tenant beta |
| AI-11 | Member não pode deletar | member@alpha | Lia explica restrição de role |
| AI-12 | Delete exige confirmação | admin@alpha | Dialog aparece, cancelar não deleta |

### Checklist QA manual

**Funcional**
- [ ] Lia responde sempre em português, mesmo com input em inglês
- [ ] Streaming aparece token por token sem travamento
- [ ] Histórico persiste entre sessões no plano Pro
- [ ] Histórico não persiste no plano Starter

**Segurança**
- [ ] Prompt injection não altera comportamento
- [ ] Member não consegue executar ações de admin mesmo descrevendo o que quer
- [ ] Requests paralelos não permitem ultrapassar o limite (incremento atômico)

**Performance**
- [ ] TTFB do primeiro token < 2.000ms
- [ ] Painel abre em < 200ms (animação fluida)

**Billing**
- [ ] Contador incrementa após cada mensagem enviada
- [ ] Badge atualiza imediatamente após envio (sem necessidade de refresh)

### Seed data necessário
- [ ] Tenant `ai-test` com plano `pro` e módulos: proposals, contacts, products, financial
- [ ] Usuário `ai-admin@test.com` / `Test1234!` com role `admin`
- [ ] Usuário `ai-member@test.com` / `Test1234!` com role `member`

### Critério de conclusão
Todos os 12 casos E2E passando no CI. Checklist QA manual 100% verificado.

---

## Dependências externas

| Dependência | Como obter | Onde usar |
|---|---|---|
| `@google/generative-ai` | `npm install @google/generative-ai` (functions/) | `chat.function.ts` |
| `GEMINI_API_KEY` | Google AI Studio (aistudio.google.com) — sem cartão obrigatório | `.env`, GitHub Secrets |

---

## Registrar no ROADMAP.md

```markdown
## v3.0 — AI Assistant (Lia)
- [x] Fase 1: Arquitetura & Pesquisa
- [ ] Fase 2: Backend Core
- [ ] Fase 3: Tool System
- [ ] Fase 4: Frontend Chat UI
- [ ] Fase 5: Segurança & Billing
- [ ] Fase 6: Testes & QA
```