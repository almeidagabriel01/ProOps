# Phase 18: fix(lia): 5 correções — Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Source:** PRD Express Path (user message — spec completa com 5 bugs definidos)

<domain>
## Phase Boundary

Esta fase corrige 5 bugs específicos na feature Lia, sem adicionar funcionalidades novas.
Todos os bugs foram identificados durante QA manual (Fase 17). As correções tocam:
- Backend: `functions/src/ai/chat.route.ts`, `functions/src/ai/context-builder.ts`
- Frontend: `src/hooks/useLiaSession.ts`, `src/components/lia/lia-message-bubble.tsx`,
  `src/components/lia/lia-input-bar.tsx`, `src/components/lia/lia-tool-result-card.tsx`,
  `src/components/lia/lia-container.tsx`, `src/components/lia/lia-trigger-button.tsx`,
  `src/components/lia/lia-panel.tsx`

</domain>

<decisions>
## Implementation Decisions

### Bug 1 — Contador de uso: incrementar só após stream bem-sucedido
- `incrementAiUsage()` deve ser chamado SOMENTE após o stream da Groq/Gemini completar com sucesso
- Se `requiresConfirmation=true`, NÃO incrementar — a troca ainda não está completa
- Se a API retornar erro (SDK throws 429, 500, etc.), NÃO incrementar — já funciona via try/catch
- Implementação: adicionar flag `skipIncrement = false` no início do bloco try; setar `skipIncrement = true` em todos os paths que envolvem `requiresConfirmation`; envolver `incrementAiUsage` em `if (!skipIncrement)`
- Deve funcionar para ambos os paths: Groq (dev) e Gemini (prod)

### Bug 2 — Histórico: sessionId inicializado antes de tenantId/persistHistory estarem disponíveis
- O bug root: `useState(() => localStorage.getItem(...))` roda quando `tenantId=null`, então gera ID novo em vez de restaurar. O efeito de persist depois salva esse ID errado, sobrescrevendo o anterior.
- Correção: remover restauração do `useState` initializer. Inicializar `sessionId` sempre com `generateSessionId()`.
- Adicionar `useEffect` de restauração: quando `persistHistory` e `tenantId` ficarem disponíveis pela primeira vez, restaurar o ID do localStorage (se existir) via `setSessionId(stored)`.
- Usar `useRef` (`isRestoredRef`) para garantir que a restauração aconteça uma única vez.
- O efeito de persist existente já está correto — só não pode rodar antes da restauração (o `isRestoredRef` garante isso).
- Starter: nunca persiste, `isRestoredRef` nunca é setado — comportamento correto.
- Pro/Enterprise: restaura da primeira vez que `persistHistory=true` e `tenantId` estão disponíveis.

### Bug 3 — Quebras de linha: preservar `\n` em mensagens do usuário e da Lia
- `LiaMessageBubble` — mensagens do usuário: substituir `<span>{message.content}</span>` por `<span className="whitespace-pre-wrap">{message.content}</span>`
- `LiaMessageBubble` — mensagens da Lia em streaming: mesma correção — `<span className="whitespace-pre-wrap">{message.content}</span>`
- `LiaMessageBubble` — mensagens da Lia pós-stream (ReactMarkdown): instalar e usar o plugin `remark-breaks` para que `\n` simples vire `<br/>`. Adicionar `remarkPlugins={[remarkBreaks]}` ao `<ReactMarkdown>`.
- `remark-breaks` já está disponível como dependência da `remark` (verificar; se não estiver, instalar com `npm install remark-breaks`)
- `LiaInputBar.handleSend()`: `value.trim()` remove espaços leading/trailing mas preserva `\n` internos — CORRETO, não modificar.
- `useAiChat.sendMessage()`: `text.trim()` — mesma análise — CORRETO, não modificar.

### Bug 4 — Minimizar: panel sempre montado, usar CSS transition
- `LiaContainer`: remover conditional rendering do `LiaTriggerButton` (`{!chat.isOpen && <LiaTriggerButton/>}`)
- `LiaTriggerButton` deve ser renderizado SEMPRE mas visualmente escondido quando o panel está aberto
- Adicionar `data-state={chat.isOpen ? "open" : "closed"}` ao `LiaTriggerButton` e ao `LiaPanel` (`<aside>`)
- `LiaTriggerButton` recebe `isOpen` prop e aplica classe CSS baseada nele: quando `isOpen=true`, esconder com `opacity-0 pointer-events-none scale-75 transition-all`; quando `false`, mostrar normalmente
- `LiaPanel` já usa opacity/scale/pointer-events CSS corretamente — adicionar apenas `data-state` attr
- Verificar: o panel (`<aside>`) NUNCA usa `{isOpen && <LiaPanel/>}` — correto, já é sempre montado
- Resultado: scroll, mensagens, estado de streaming — tudo preservado ao fechar e reabrir

### Bug 5a — Tool results: chip minimalista por padrão
- `LiaToolResultCard`: redesenhar collapsed state para ser um chip/inline badge
- Estado recolhido (padrão): `<span>` com ícone Wrench + nome da tool + "· Concluído"
- O texto "Concluído" vem de `getSummary()` (já existe) quando não há summary específico
- Adicionar trigger de "Ver detalhes" apenas como texto link (ex: `<button>Ver detalhes ▾</button>`) integrado ao chip
- Estado expandido: mostra o `<pre>` com JSON — como hoje
- Visual do chip: inline, com `rounded-full`, `border`, `bg-muted/50`, `text-xs` — discreto
- NUNCA mostrar o JSON bruto fora do `CollapsibleContent`

### Bug 5b — System prompt: regra explícita para não expor IDs
- `context-builder.ts`: adicionar regra específica na seção "Regras de segurança" (após regra 11 existente):
  `"NUNCA inclua IDs internos (id, tenantId, uid) nas respostas ao usuário. Ao confirmar uma ação, use o nome do registro, não o ID. Correto: 'Produto \"IA Teste\" criado com sucesso por R$ 150,00'. Errado: 'Produto criado (id: 7AgD...)'."`
- Nota: regras 11 e 22 já cobrem parcialmente isso — a nova regra torna a instrução mais específica e com exemplo

### Claude's Discretion
- Ordem exata dos plans/waves (agrupamento backend vs frontend em waves paralelas)
- Estilos exatos do chip no LiaToolResultCard (desde que sejam discretos e não chamem atenção)
- Como importar e usar `remark-breaks` (verificar se já instalado antes de instalar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquivos a modificar (ler antes de qualquer mudança)
- `functions/src/ai/chat.route.ts` — Bug 1: fluxo de incremento, localizar onde `incrementAiUsage` é chamado
- `functions/src/ai/context-builder.ts` — Bug 5b: adicionar regra ao system prompt
- `src/hooks/useLiaSession.ts` — Bug 2: lógica de sessionId e localStorage
- `src/components/lia/lia-message-bubble.tsx` — Bug 3: renderização de conteúdo
- `src/components/lia/lia-input-bar.tsx` — Bug 3: trim behavior
- `src/components/lia/lia-tool-result-card.tsx` — Bug 5a: redesign do card
- `src/components/lia/lia-container.tsx` — Bug 4: conditional rendering do trigger
- `src/components/lia/lia-trigger-button.tsx` — Bug 4: CSS transition ao esconder
- `src/components/lia/lia-panel.tsx` — Bug 4: data-state attribute

### Arquivos de contexto (leitura para entender padrões)
- `functions/src/ai/usage-tracker.ts` — entender `incrementAiUsage` e `checkAiLimit`
- `functions/src/ai/conversation-store.ts` — entender `saveConversation` / `loadConversation`
- `src/hooks/useAiChat.ts` — entender estrutura de `messages`, `isOpen`, `isStreaming`
- `src/types/ai.ts` — tipos `LiaMessage`, `AiConversationMessage`, `AI_TIER_LIMITS`
- `package.json` — verificar se `remark-breaks` já está instalado

### Regras do projeto
- `CLAUDE.md` — nunca Co-Authored-By, sem atalhos, sem features extras
- `.claude/rules/backend.md` — regras de logging, autenticação, Firestore
- `.claude/rules/frontend.md` — padrões de componentes, hooks, styling

</canonical_refs>

<specifics>
## Specific Implementation Details

### Bug 1 — Trecho exato do chat.route.ts a modificar
O bloco `try {}` (linhas após `res.flushHeaders()`) contém os dois paths (Groq e Gemini).
Cada path tem um `while (toolRound < MAX_TOOL_ROUNDS)` loop.
O `requiresConfirmation` handling em Groq: `toolRound = MAX_TOOL_ROUNDS; exitLoop = true; break;`
O `requiresConfirmation` handling em Gemini: `toolRound = MAX_TOOL_ROUNDS; break;` (dentro do for)

**Mudança exata:**
1. Antes do `if (groqApiKey)`: adicionar `let skipIncrement = false;`
2. No Groq path, onde `exitLoop = true`: adicionar `skipIncrement = true;`
3. No Gemini path, onde `toolRound = MAX_TOOL_ROUNDS; break;` dentro do for de tool results: adicionar `skipIncrement = true;`
4. Linha `await incrementAiUsage(...)`: envolver em `if (!skipIncrement) { await incrementAiUsage(...); }`
5. O `saveConversation` e `getAiUsage` após o incremento: também envolver em `if (!skipIncrement)` pois não faz sentido salvar conversa incompleta

### Bug 2 — Trecho exato do useLiaSession.ts a modificar
O `useState<string>(() => { ... localStorage.getItem ... })` deve ser simplificado para:
```
const [sessionId, setSessionId] = useState<string>(generateSessionId);
```
Adicionar `const isRestoredRef = useRef(false);`

Novo `useEffect` de restauração (adicionar ANTES do efeito de persist):
```
useEffect(() => {
  if (isRestoredRef.current) return;
  if (!persistHistory || !tenantId) return;
  isRestoredRef.current = true;
  const stored = localStorage.getItem(getStorageKey(tenantId));
  if (stored) {
    setSessionId(stored);
  }
}, [persistHistory, tenantId]);
```

O efeito de persist existente deve verificar `isRestoredRef.current`:
```
useEffect(() => {
  if (!persistHistory || !tenantId || !isRestoredRef.current) return;
  localStorage.setItem(getStorageKey(tenantId), sessionId);
}, [sessionId, tenantId, persistHistory]);
```

### Bug 3 — Trecho exato do lia-message-bubble.tsx
Linha: `<span>{message.content}</span>` → `<span className="whitespace-pre-wrap">{message.content}</span>`
Ocorre em 2 lugares: user messages E streaming lia messages (ambos usam o mesmo condicional `isUser || message.isStreaming`).

Para ReactMarkdown pós-stream:
```jsx
import remarkBreaks from "remark-breaks";
// ...
<ReactMarkdown remarkPlugins={[remarkBreaks]}>{message.content}</ReactMarkdown>
```

### Bug 4 — LiaContainer: antes vs depois
ANTES: `{!chat.isOpen && <LiaTriggerButton isOpen={false} ... />}`
DEPOIS: `<LiaTriggerButton isOpen={chat.isOpen} ... />` (sempre renderizado)

LiaTriggerButton deve esconder quando `isOpen=true`:
```jsx
className={cn(
  "fixed bottom-6 right-6 z-50",
  // ... classes existentes ...
  "transition-all duration-300 ease-in-out",
  isOpen && "opacity-0 scale-75 pointer-events-none",
)}
```

LiaPanel aside: adicionar `data-state={isOpen ? "open" : "closed"}` — não muda lógica, só atributo.

### Bug 5a — LiaToolResultCard: chip design
Estado collapsed (default):
```jsx
<div className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground">
  <Wrench className="w-3 h-3 shrink-0" aria-hidden />
  <span className="font-medium text-foreground">{toolName}</span>
  <span>·</span>
  <span>{summary}</span>
  <CollapsibleTrigger asChild>
    <button type="button" className="ml-1 underline underline-offset-2 hover:text-foreground transition-colors">
      {isOpen ? "Recolher" : "Ver detalhes"}
    </button>
  </CollapsibleTrigger>
</div>
```

</specifics>

<deferred>
## Deferred Ideas

- Persistência de histórico para plano Starter (out of scope desta fase)
- UI de histórico completo (sessões anteriores) — já implementado na Fase 15
- Métricas de uso de tokens por tool call

</deferred>

---

*Phase: 18-fix-lia-5-correções*
*Context gathered: 2026-04-15 via PRD Express Path (user spec)*
