# /deploy-check

Antes de fazer deploy, execute esta checklist completa:

1. **Build check — TODOS devem passar sem erros nem warnings:**
   ```bash
   npm run lint                           # ESLint frontend — zero erros e zero warnings
   npm run build                          # Next.js production build
   cd apps/functions && npm run build && cd .. # Compila TypeScript das Cloud Functions
   ```
   - **Erros de lint devem ser corrigidos**, nunca suprimidos com `// eslint-disable` ou regras desabilitadas.
   - **Warnings de lint também devem ser corrigidos** — eles indicam bugs potenciais (deps ausentes em hooks, diretivas desnecessárias, etc.).
   - Se o build falhar (frontend ou backend), **parar aqui e corrigir** antes de continuar.
   - Nunca usar `// @ts-ignore`, `// @ts-expect-error` ou `any` para fazer TypeScript passar.

2. **TypeScript check:**
   Verifique se há erros de tipo óbvios nos arquivos modificados nesta sessão.

3. **Security scan rápido:**
   - Verifique se há `console.log` com dados sensíveis (tokens, senhas, dados de usuário) no código modificado
   - Confirme que nenhum arquivo `.env*` ou `*serviceAccount*` foi tocado
   - Verifique se `apps/functions/.env.*` não foi alterado acidentalmente

4. **Impacto Firestore:**
   - Algum schema de coleção foi alterado (campos adicionados/removidos/renomeados)?
   - Alguma Security Rule foi modificada?
   - Algum índice novo é necessário em `firestore.indexes.json`?
   - Se sim em qualquer um: **PARAR** e criar plano de migração

5. **Impacto de billing:**
   - A mudança toca código de Stripe, WhatsApp billing ou Cloud Functions de scheduled jobs?
   - Se sim: revisão manual obrigatória antes de qualquer deploy para prod

6. **Resumo final:**
   Gere um bloco com:
   ```
   Arquivos modificados: [lista]
   Risco estimado: Baixo / Médio / Alto
   Impacto em Firestore: Sim / Não
   Impacto em billing: Sim / Não
   Pronto para deploy: Sim / Não
   Observações: [se houver]
   ```

7. **Se pronto:**
   ```bash
   # Dev first, always
   npm run deploy:dev
   # Prod apenas após validação no dev
   # npm run deploy:prod
   ```
