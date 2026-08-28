# Ativação do Google Calendar — passo a passo

> **Validado em 25/08/2026, rodando local contra o Firestore real de dev.** O
> fluxo OAuth completou, e o refresh token foi gravado **cifrado**:
> `refreshTokenEnc: "kms:v1:..."` (255 chars) com `refreshToken: ""` vazio.
> Foi a primeira vez que a criptografia KMS do Calendar rodou de verdade — até
> então existia só no código.
>
> Falta ligar em **produção**, que já está pronta do lado do Google
> (verificada, escopo aprovado, URI correto). Ver Passo 5.

---

## A pergunta que decidia tudo — já respondida

O código pede o escopo `calendar.events.owned`, que o Google classifica como
**sensível**. Para app não verificado isso significa: máximo 100 usuários
adicionados na mão, e **refresh token expirando em 7 dias** — cada cliente
reconectando a agenda toda semana.

**Verificado em 25/08/2026: o app de produção JÁ ESTÁ VERIFICADO pelo Google.**

No console de `erp-softcode-prod`, em Google Auth Platform → Visão geral,
aparece o card *"Verificação de apps OAuth — O aplicativo foi verificado pelo
Google"*, junto com *"Verificação de domínio — usando domínios autorizados"*.

Ou seja: **em produção não há limite de usuários nem expiração de 7 dias.** O
bloqueador que justificaria manter a funcionalidade desligada não existe.

O projeto de dev **não** tem esses cards, o que é normal — projeto de
desenvolvimento não passa por verificação. Lá a tela fica em modo de teste e é
preciso adicionar os e-mails na lista de usuários de teste para conectar.

---

## O que já está pronto

Verificado em 25/08/2026:

| Item | dev | prod |
|---|---|---|
| Calendar API habilitada no projeto | ✅ | ✅ |
| `GOOGLE_CALENDAR_CLIENT_ID` e `_SECRET` | ✅ | ✅ |
| Chave KMS `calendar-refresh-token` + IAM | ✅ | ✅ |
| `CALENDAR_TOKEN_KMS_KEY` no serviço | ✅ (deploy 25/08) | ❌ falta deploy |
| App OAuth verificado pelo Google | — (não precisa) | ✅ |
| Verificação de domínio | — | ✅ |
| Status de publicação | `Testando` | `Em produção` |
| Escopo `calendar.events.owned` | ❌ não declarado | ✅ **aprovado** |
| URI de redirecionamento | só `localhost:3000` | ✅ `proops.com.br` |
| `GOOGLE_CALENDAR_SYNC_ENABLED` | `true` (local) | `false` |
| `NEXT_PUBLIC_GOOGLE_CALENDAR_SYNC_ENABLED` | `true` (local) | ❓ |

> **O limite de 100 usuários não se aplica a produção.** A própria tela explica:
> apps verificados continuam exibindo o limite, mas ele não é aplicado quando os
> escopos confidenciais estão aprovados — que é o caso.

### O caminho de validação foi local, não o dev deployado

O cliente OAuth de dev tem **apenas `http://localhost:3000/...`** cadastrado — foi
feito para desenvolvimento local, não para o ambiente dev da Vercel. E isso é
conveniente: no emulador o código usa `LOCAL_APP_URL` (padrão
`http://localhost:3000`), que bate exatamente com o registrado.

Testar contra o **dev deployado** daria `redirect_uri_mismatch` até alguém
cadastrar a URL da Vercel no console. Não é necessário — local prova a mesma
coisa, com a chave KMS real e o Google real.

O projeto de dev também não tem **nenhum escopo declarado** em Acesso a dados, e
tem o branding incompleto (é o que deixa "Publicar app" desabilitado). Nada disso
impede o modo de teste.

O KMS era o bloqueador silencioso e já foi resolvido em dev. Sem ele,
`encryptToken` lançava e conectar a agenda falhava com `?error=oauth_failed` —
sem gravar nada, o que é o comportamento correto, mas sem explicar o motivo.

---

## Passo 1 — Verificar a tela de permissão OAuth

> O console foi reorganizado: hoje é **Google Auth Platform**, não mais
> "APIs e Serviços → Tela de permissão OAuth". Os menus abaixo são os atuais.

**Console → Google Auth Platform → Público-alvo**
(projeto `erp-softcode` para dev, `erp-softcode-prod` para produção)

**Tipo de usuário** deve ser **Externo**. "Interno" limita a contas do mesmo
Workspace — inútil para clientes.

**Status de publicação:**

- `Em produção` → aberto a qualquer usuário. É o esperado em prod, que já está
  verificado.
- `Em teste` → esperado em dev. Há uma lista de **Usuários de teste** logo
  abaixo; adicione ali o e-mail que for usar na validação, senão o Google recusa
  com "app não verificado".

**Console → Google Auth Platform → Acesso a dados** — os escopos devem ser:
```
.../auth/calendar.events.owned      ← sensível
.../auth/userinfo.email
```

> `calendar.events.owned` dá acesso só aos eventos criados pelo próprio app, e
> não à agenda inteira. É a escolha certa e facilita a verificação — bem mais
> simples que `calendar` completo, que é escopo restrito e exige avaliação de
> segurança por terceiro.

---

## Passo 2 — Verificar os URIs de redirecionamento

**Console → Google Auth Platform → Clientes → o cliente OAuth 2.0 (tipo Aplicativo da Web)**

Em **URIs de redirecionamento autorizados**, precisam estar exatamente:

```
https://proops.com.br/api/backend/v1/calendar/google/callback
https://template-erp-git-develop-gestao-2562s-projects.vercel.app/api/backend/v1/calendar/google/callback
```

Sem barra no final, exatamente com esse caminho.

O backend deriva a URL de `APP_URL` — que hoje é `https://proops.com.br/` em
produção e a URL da Vercel em dev — normalizando a barra final. Existe também
`GOOGLE_CALENDAR_REDIRECT_URI` como override explícito, hoje não configurado em
nenhum ambiente.

> A origem **nunca** vem do header da requisição, só de `APP_URL`. Foi um
> hardening deliberado (M1): usar o host da requisição deixaria um atacante
> influenciar o `redirect_uri` via `x-forwarded-host`.

---

## Passo 3 — Ligar em dev

Só depois dos passos 1 e 2.

**Backend** — `apps/functions/.env.erp-softcode`:
```
GOOGLE_CALENDAR_SYNC_ENABLED=true
```
E deployar: `npm run deploy:dev`

**Frontend** — na Vercel, no ambiente correspondente ao deploy de dev:
```
NEXT_PUBLIC_GOOGLE_CALENDAR_SYNC_ENABLED=true
```
Precisa de **redeploy** — variável `NEXT_PUBLIC_*` é embutida no build, não lida
em tempo de execução.

> As duas flags são independentes e ambas com default `false`. Ligar só o
> backend não mostra nada na tela; ligar só o frontend mostra um botão que
> falha.

---

## Passo 4 — Conectar uma agenda de verdade

1. Entrar em `/calendar` com um usuário **master** do tenant
2. Conectar o Google Calendar
3. Autorizar

**Esperado:** volta para `/calendar?googleCalendar=connected`.

**Se voltar com `?googleCalendar=error`**, o `reason` diz o quê:

| `reason` | Causa provável |
|---|---|
| `oauth_failed` | Genérico — ver logs. **Se o KMS não estiver no serviço, é aqui que aparece** |
| `invalid_state` | State expirado ou reutilizado; refazer o fluxo |
| `expired_state` | Demorou demais entre iniciar e autorizar |
| `invalid_request` | Faltou parâmetro no callback |

Erro do próprio Google, antes de voltar ao app:

| Mensagem | Causa |
|---|---|
| `redirect_uri_mismatch` | Passo 2 — URI não cadastrado ou com diferença |
| `access_blocked` / "app não verificado" | Passo 1 — usuário fora da lista de teste |

5. Confirmar no Firestore que o token foi gravado **cifrado**:

```
calendar_integrations/{tenantId} →
  refreshTokenEnc: "kms:v1:..."   ← deve começar com kms:v1:
  refreshToken:    ""             ← deve estar VAZIO
```

> Se `refreshToken` tiver conteúdo em texto puro, **pare**. O código escreve os
> dois campos de propósito — o cifrado preenchido e o legado zerado. Texto puro
> ali significa que algo caiu no caminho de migração antigo.

---

## Passo 5 — Produção

Só depois do passo 4 funcionar em dev, e **só se a tela de permissão estiver
verificada**.

1. Deployar para levar `CALENDAR_TOKEN_KMS_KEY` ao serviço de produção —
   hoje ela está no arquivo mas não no serviço
2. `GOOGLE_CALENDAR_SYNC_ENABLED=true` em `.env.erp-softcode-prod`
3. `NEXT_PUBLIC_GOOGLE_CALENDAR_SYNC_ENABLED=true` na Vercel de produção
4. **Atualizar o secret `FUNCTIONS_ENV_PRODUCTION` no GitHub**, senão o próximo
   deploy pelo CI reverte tudo:

```bash
gh secret set FUNCTIONS_ENV_PRODUCTION --env production \
  --repo almeidagabriel01/ProOps < apps/functions/.env.erp-softcode-prod
```

---

## Se a tela estiver em "Em teste"

Duas saídas, e a escolha é de produto:

**Solicitar verificação.** Em Google Auth Platform → Central de verificação.
Para escopo sensível o Google pede vídeo demonstrando o uso, política de
privacidade e domínio verificado. Leva de dias a semanas.

> Em **produção isso já foi feito** — o app está verificado. Esta seção vale
> apenas para o projeto de dev, onde normalmente não compensa: adicionar
> usuários de teste resolve.

**Manter em teste e usar como piloto.** Adicionar os e-mails dos clientes na
lista de usuários de teste e conviver com a reconexão a cada 7 dias. Só faz
sentido para validar com um ou dois clientes antes de investir na verificação.

> O que **não** funciona é ligar em produção com a tela em teste e não avisar:
> o cliente conecta, funciona por uma semana e para sozinho, sem mensagem de
> erro clara.

---

## Escopos: por que foram alterados em 25/08/2026

Conectando em **produção**, a agenda ficou "Conectado" mas com o erro
*"Request had insufficient authentication scopes"*.

O escopo aprovado era `calendar.events.owned` — *"See, create, change, and
delete events on calendars you own"*. Na prática ele foi desenhado para agendas
**secundárias** criadas pelo usuário e **não alcança a `primary`**, que é a que
este módulo sincroniza.

Verificado em produção, as duas direções falharam:

| Direção | Chamada | Resultado |
|---|---|---|
| Google → ProOps | `GET /calendars/primary/events` | ❌ insufficient scopes |
| ProOps → Google | `POST /calendars/primary/events` | ❌ insufficient scopes |

O da importação aparecia no log do Cloud Run; o do envio ficava gravado em
`calendar_events/{id}.googleSync.lastError`, invisível no console — foi preciso
consultar o Firestore para encontrá-lo.

> **O recurso nunca funcionou, nem parcialmente.** Não foi regressão do deploy:
> era assim desde sempre, escondido atrás da flag desligada.

**Correção:** escopo trocado para **`calendar.events`** — *"View and edit events
on all your calendars"* —, que cobre leitura e escrita na `primary`.

Um escopo só, e não `owned` + `readonly`: como a escrita em `primary` já exige o
escopo amplo, separar a leitura não reduziria privilégio nenhum e dobraria o
trabalho de verificação.

### O que isso exige

1. **Declarar `calendar.events` no console** — Google Auth Platform → Acesso a
   dados → Adicionar escopos, nos dois projetos. Em dev, a lista está vazia;
   declare também `userinfo.email`.
2. **Re-verificação em produção.** O app está verificado com o escopo antigo;
   trocar por um escopo sensível diferente reabre o processo — vídeo
   demonstrativo, política de privacidade, revisão do Google. Dias a semanas.
3. **Todo mundo precisa reconectar.** O refresh token guardado foi emitido para
   o escopo antigo. Não há como migrar isso pelo servidor.

### A mensagem agora diz o que fazer

`isInsufficientScopeError` detecta o caso e grava em `lastSyncError`:

> *"A permissão concedida ao Google Agenda está desatualizada. Clique em
> Reconectar para autorizar a leitura dos seus eventos."*

Em vez de *"Request had insufficient authentication scopes"*, que não significa
nada para quem instala cortina. O botão **Reconectar** já existe no card.

### Enquanto a verificação não sai

Como **nenhuma** direção funciona com o escopo antigo, manter a flag ligada em
produção só expõe um recurso quebrado. Recomendado **desligar
`GOOGLE_CALENDAR_SYNC_ENABLED` em produção** até a re-verificação concluir.

Em **dev não é preciso esperar**: o projeto está em modo de teste, onde escopos
não verificados podem ser concedidos (com o aviso de "app não verificado").
Declare `calendar.events` no console de dev, rode local, desconecte e reconecte.

---

## Reverter

Se algo der errado, desligar é seguro e imediato: `GOOGLE_CALENDAR_SYNC_ENABLED=false`
e redeploy. As integrações já gravadas ficam intactas — o código só para de
sincronizar (`isGoogleCalendarDisabled()` retorna cedo em todos os caminhos).
