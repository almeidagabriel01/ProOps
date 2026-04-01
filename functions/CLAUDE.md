# CLAUDE.md — functions/ (Firebase Cloud Functions)

## Contexto
Backend em produção com clientes ativos. Express monolith registrado como uma única Cloud Function V2
rodando no Cloud Run em `southamerica-east1`. Mudanças aqui afetam TODOS os tenants imediatamente após deploy.

## Stack
- Node.js 20
- Firebase Functions V2
- Express (monolith)
- TypeScript → compila para CommonJS em `functions/lib/`
- Firebase Admin SDK

## Estrutura
```
functions/src/
├── index.ts              # Entry point — registra a Cloud Function principal
├── init.ts               # Inicialização do Firebase Admin
├── api/
│   ├── controllers/      # ~20 controllers CRUD
│   ├── routes/           # 13 grupos de rotas
│   ├── middleware/        # Auth verification, rate limiting
│   ├── helpers/           # Helpers de rotas
│   └── security/          # Security observability
├── lib/                  # Helpers de negócio (auth, billing, storage, etc.)
├── services/             # PDF (Playwright), WhatsApp, proposals, notifications
├── shared/               # Tipos compartilhados com controllers
├── scripts/              # Scripts de manutenção one-time
├── checkDueDates.ts      # Cron: verifica vencimentos
├── checkManualSubscriptions.ts  # Cron: assinaturas manuais
├── checkStripeSubscriptions.ts  # Cron: status Stripe
├── cleanupStorageAndSharedLinks.ts  # Cron: limpeza de storage
├── reportWhatsappOverage.ts     # Cron: billing WhatsApp (dia 1, 03:00 AM)
└── deploymentConfig.ts   # Configuração de deploy (região, memória, timeout)
```

## Projetos Firebase
- `erp-softcode` → dev (`.env.erp-softcode`)
- `erp-softcode-prod` → produção (`.env.erp-softcode-prod`)

## Comandos
```bash
# Build
cd functions && npm run build        # Compila TypeScript → functions/lib/
cd functions && npm run build:watch  # Watch mode para dev

# Dev local
npm run dev:backend  # (na raiz) build:watch + emuladores Firebase

# Deploy
npm run deploy:dev   # (na raiz) → erp-softcode
npm run deploy:prod  # (na raiz) → erp-softcode-prod

# Lint
cd functions && npm run lint
```

## Regras críticas

### Autenticação
- TODA rota protegida valida token Firebase no início via middleware
- Custom claims verificados: `tenantId`, `role`, `masterId`
- Stale claims fallback: middleware cai para user document se claims desatualizados

### Multi-tenancy
- TODA query Firestore filtra por `tenantId`
- IDs validados contra `tenantId` do token (não apenas do body)
- Nunca retornar dados de um tenant para outro

### Billing e Stripe
- Webhook valida assinatura com `stripe.webhooks.constructEvent`
- Deploy em produção de qualquer mudança de billing: revisão manual obrigatória
- Scheduled functions de billing: testar no emulador antes de prod

### Firestore
- Transações para operações multi-documento
- `limit()` em TODA query de listagem
- Novos índices: criar no console Firebase e exportar para `firestore.indexes.json`
- Mudanças de schema: plano de migração antes de qualquer deploy

### Secrets
- Ficam APENAS em `functions/.env.erp-softcode` e `functions/.env.erp-softcode-prod`
- Nunca commitar — arquivos ignorados pelo `.gitignore`
- Usar `functions/.env.example` como referência (sem valores reais)

### Logging
- Usar `console.log/error` (Firebase Functions captura automaticamente)
- Incluir contexto: `[nomeHandler] mensagem` para facilitar busca nos logs
- NUNCA logar tokens, senhas ou dados pessoais

## Checklist antes de deploy para prod
- [ ] Testado localmente com `npm run dev:backend`
- [ ] `cd functions && npm run build` sem erros
- [ ] Se mudou billing/Stripe: revisão manual feita
- [ ] Se mudou schema Firestore: migração planejada e testada
- [ ] Se mudou Security Rules: testadas com Firebase Emulator
- [ ] Deploy para dev primeiro: `npm run deploy:dev`
- [ ] Validar comportamento no ambiente dev antes de prod
