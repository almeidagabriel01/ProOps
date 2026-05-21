# Skill: Revisão de Segurança

## Quando esta skill é invocada
Quando o usuário pede para revisar segurança de uma feature, endpoint ou código.

## Checklist — Cloud Functions / API Routes

### Autenticação e Autorização
- [ ] Toda rota protegida verifica token Firebase no início
- [ ] Custom claims validados: `tenantId`, `role`, `masterId`
- [ ] Fallback de claims stale implementado (via user document)
- [ ] Retorna 401 imediatamente se não autenticado
- [ ] Retorna 403 se autenticado mas sem permissão

### Multi-tenancy
- [ ] TODA query Firestore filtra por `tenantId`
- [ ] IDs de documentos validados contra o `tenantId` do token (não só o body)
- [ ] Dados de um tenant nunca expostos para outro

### Inputs e Dados
- [ ] Todos os inputs do request validados antes de qualquer operação
- [ ] Sem interpolação de strings em queries (NoSQL injection)
- [ ] Dados retornados não incluem campos sensíveis desnecessários
- [ ] Rate limiting considerado para endpoints públicos (PDF, shared proposals)

### Secrets e Ambiente
- [ ] Secrets apenas em `apps/functions/.env.*` — nunca no frontend
- [ ] `NEXT_PUBLIC_*` apenas para dados verdadeiramente públicos
- [ ] Sem `console.log` com tokens, IDs de usuários ou dados de negócio
- [ ] `.env.local` e `apps/functions/.env.*` não commitados

## Checklist — Firebase Security Rules
- [ ] Regras DENY-by-default — toda coleção nova tem regra explícita
- [ ] Leitura valida `tenantId` do token contra o documento
- [ ] Escrita valida campos obrigatórios e tipos
- [ ] Regras testadas localmente antes do deploy
- [ ] Não usa `allow read, write: if true` em coleções com dados de usuário

## Checklist — Frontend
- [ ] Dados sensíveis não armazenados no `localStorage` ou `sessionStorage`
- [ ] Sem `dangerouslySetInnerHTML` com dados do usuário (XSS)
- [ ] Proteção de rotas no `middleware.ts` (server-side, não só client-side)
- [ ] API calls apenas para `/api/backend/*` — nunca diretamente para Cloud Functions URLs
- [ ] Firebase client SDK não faz operações de admin (apenas leitura e operações permitidas pelas Rules)

## Checklist — Stripe / Billing
- [ ] Webhook valida assinatura (`stripe.webhooks.constructEvent`)
- [ ] Idempotência: processar mesmo evento duas vezes não gera cobranças duplicadas
- [ ] Mudanças de plan testadas no ambiente dev antes de prod

## Checklist — WhatsApp
- [ ] Webhook verifica `WHATSAPP_VERIFY_TOKEN`
- [ ] Cron de overage (`reportWhatsappOverage`) não exposto publicamente
- [ ] Endpoint interno protegido com `x-cron-secret` header

## Como usar
Descreva o código ou feature que quer revisar, ou forneça o path do arquivo.
Vou executar o checklist acima e reportar os problemas encontrados com severidade (Alta/Média/Baixa).
