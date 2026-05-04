# /debug

Vou investigar o problema sistematicamente usando o método científico.

## Passo 1 — Coleta de informações
Cole aqui:
- Mensagem de erro exata (completa, incluindo stack trace)
- Onde ocorre: browser console, Firebase Functions log, terminal?
- Quando ocorre: sempre, às vezes, em condição específica?
- Funciona em dev/emulador mas não em prod? (ou vice-versa?)

## Passo 2 — Identificar a camada
Vou determinar onde está o problema:
- **Frontend**: componente, hook, state, routing
- **Service/API call**: `src/services/`, chamada para `/api/backend/*`
- **Next.js proxy**: `src/app/api/backend/`
- **Cloud Function Express**: `apps/functions/src/api/`
- **Firestore**: query, regras de segurança, índice faltando
- **Firebase Auth**: token expirado, custom claims desatualizados
- **Stripe/WhatsApp**: webhook, billing

## Passo 3 — Rastrear o fluxo
Vou ler os arquivos relevantes e mapear o caminho completo dos dados:
```
Componente → Hook → Service → API route → Cloud Function → Firestore
```

## Passo 4 — Hipóteses (em ordem de probabilidade)
Vou listar as causas mais prováveis antes de propor fix.

## Passo 5 — Fix
Vou propor a correção explicando:
- O que estava errado
- Por que estava errado
- O que mudou

## Regras durante o debug

### Dados de produção
- **NUNCA** alterar dados no Firestore de produção sem confirmação explícita do usuário
- Para investigar: usar Firebase Console (leitura) ou emulador com dados de teste

### Custom claims
Se o bug for de auth/permissão, verificar logs do middleware de auth e o documento `users/{uid}` no Firestore para checar consistência de claims.

### Logs de Cloud Functions
- Logs ficam no Firebase Console → Functions → Logs
- Para debug local: `npm run dev:backend` (emulador com watch mode)

### Firestore índice faltando
Erro típico: `FAILED_PRECONDITION: The query requires an index`
→ Abrir o link no erro, criar o índice no console, exportar para `firestore.indexes.json`
