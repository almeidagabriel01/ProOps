# Efeitos sonoros da Lia — Design

**Data:** 2026-07-06
**Status:** Aprovado

## Objetivo

Adicionar feedback sonoro às ações do chat da Lia (enviar, digitar, responder, erro, notificação, confirmação), com preferência do usuário persistida na conta (sincroniza entre dispositivos), sem assets externos, sem impacto de performance e sem nova superfície de segurança.

## Decisões

| Decisão | Escolha |
|---|---|
| Eventos com som | Enviar, início de digitação, resposta concluída, erro, notificação (painel fechado), confirmação de ação |
| Fonte do áudio | Web Audio API sintetizado (osciladores) — zero assets |
| Som de "digitando" | Blip único no primeiro chunk da resposta (não repete durante o stream) |
| Persistência da preferência | Firestore `users/{uid}.preferences.liaSoundsEnabled` via endpoint existente `PUT /v1/profile` (Admin SDK) |
| Padrão | Sons **ligados** (`undefined` ⇒ `true`) |
| Controle | Botão mute/unmute no header do painel da Lia |

Abordagem de persistência escolhida: **backend `v1/profile`** (validação server-side, zero mudança em security rules). Rejeitadas: escrita client-side com mudança de rules (mais superfície em rules) e localStorage (não sincroniza entre dispositivos).

## Arquitetura

### 1. Módulo de som — `apps/web/src/lib/lia-sounds.ts`

Módulo TypeScript puro (sem React), estado de módulo (singleton).

- **API pública:**
  - `playLiaSound(name: LiaSoundName): void` — fire-and-forget, nunca lança.
  - `setLiaSoundsEnabled(enabled: boolean): void` — gate síncrono lido a cada play.
  - `type LiaSoundName = "messageSent" | "typingStart" | "responseDone" | "notification" | "error" | "confirmNeeded"`.
- **AudioContext lazy:** criado na primeira chamada de `playLiaSound`, nunca no import. SSR-safe (`typeof window === "undefined"` ⇒ no-op). Browser sem Web Audio ⇒ no-op.
- **Autoplay policy:** se `ctx.state === "suspended"`, tenta `resume()`; se continuar suspenso, skip silencioso. Todo fluxo de som decorre de gesto do usuário (clique/Enter no envio), então o contexto resume naturalmente.
- **Idempotência:** mapa `lastPlayedAt` por som; intervalo mínimo de 250ms entre plays do mesmo som. Protege contra React StrictMode (double-invoke de effects) e rajadas de chunks SSE.
- **Sem leaks:** `OscillatorNode`/`GainNode` desconectados no `onended`.
- **Paleta** (todos com envelope attack/release exponencial, gain máximo 0.15):
  - `messageSent` — blip ascendente curto (~90ms)
  - `typingStart` — tick grave sutil (~60ms)
  - `responseDone` — duas notas agradáveis (~200ms)
  - `notification` — duas notas mais brilhantes (~250ms)
  - `error` — buzz grave duplo (~200ms)
  - `confirmNeeded` — tom de atenção (~180ms)

### 2. Backend — `apps/functions/src/api/controllers/users.controller.ts`

`updateProfile` passa a aceitar campo opcional `preferences`:

- Validação estrita: deve ser objeto; única chave permitida `liaSoundsEnabled`; valor deve ser `boolean`. Qualquer violação ⇒ `400` com mensagem clara.
- Escrita com dot-path (`"preferences.liaSoundsEnabled"`) para merge — não sobrescreve preferências futuras.
- Sem `preferences` no body ⇒ comportamento atual inalterado.

### 3. Types

- `apps/web/src/types/index.ts`: `User.preferences?: { liaSoundsEnabled?: boolean }`.
- Type equivalente no backend onde o controller tipa o body.

### 4. Frontend — preferência

- `UserService.updateProfile` (em `apps/web/src/services/user-service.ts`): payload estendido com `preferences?: { liaSoundsEnabled: boolean }` — continua chamando `PUT /v1/profile`.
- Hook novo `apps/web/src/hooks/useLiaSoundPreference.ts`:
  - Lê `user.preferences?.liaSoundsEnabled ?? true` do `useAuth()`.
  - Estado local otimista: `toggle()` atualiza UI imediatamente, chama o service; em erro, reverte e propaga para feedback.
  - Effect sincroniza `setLiaSoundsEnabled()` do módulo de som a cada mudança.
- UI: botão de toggle no header do `LiaPanel` (ícones `Volume2`/`VolumeX` de lucide-react), `aria-label` descritivo, junto aos botões existentes (histórico/nova sessão).

### 5. Gatilhos — pontos explícitos em `useAiChat.ts`

Emissão explícita nos pontos de transição (não observação de estado externo):

| Evento | Ponto no código | Som |
|---|---|---|
| Mensagem enviada | `sendMessage`, após append do bubble do usuário | `messageSent` |
| Lia começou a responder | Primeiro chunk `text`/`thinking` de cada envio (flag boolean por `doSend`, resetada a cada envio) | `typingStart` |
| Resposta concluída (painel aberto) | `onDone` com `isOpen === true` | `responseDone` |
| Resposta concluída (painel fechado) | `onDone` com `isOpen === false` (junto do `setHasUnread`) | `notification` (substitui `responseDone`, nunca ambos) |
| Erro | chunk `error`, callback `onError` e `catch` do `doSend` | `error` |
| Confirmação solicitada | Onde `setPendingConfirmation` é chamado | `confirmNeeded` |

Sem som em: abort/reset/nova sessão, greeting bubble, cancelamento de ação, hidratação de histórico.

## Robustez e segurança

- Zero assets, zero requests de rede, zero mudança em CSP, security rules ou índices.
- Nenhum dado sensível: preferência é um boolean.
- Validação server-side allowlist no único ponto de escrita.
- Falha de áudio nunca quebra o chat: todas as chamadas são try/catch com no-op.
- Preferência não sincronizada ainda (carregando) ⇒ default ligado; gate é atualizado quando o doc do usuário chega.

## Testes

- **Vitest** `apps/web/src/lib/__tests__/lia-sounds.test.ts` (mock de `AudioContext`):
  - gate desligado ⇒ `playLiaSound` não cria nodes;
  - debounce: duas chamadas < 250ms ⇒ toca uma vez;
  - SSR/ausência de AudioContext ⇒ no-op sem erro;
  - contexto suspended que não resume ⇒ skip sem erro.
- **Vitest** `useLiaSoundPreference`:
  - default `true` quando `preferences` ausente;
  - toggle otimista chama service com payload correto;
  - erro do service ⇒ reverte estado.
- **Jest** backend `users.controller`:
  - `preferences.liaSoundsEnabled: true/false` persiste com dot-path;
  - rejeita 400: valor não-boolean, chave desconhecida, `preferences` não-objeto;
  - update sem `preferences` permanece intacto.

## Fora de escopo

- Sons para outras features (notificações gerais, kanban etc.).
- Volume configurável (só on/off).
- Assets de áudio customizados por tenant.
