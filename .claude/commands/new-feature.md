# /new-feature

Vou implementar uma nova feature completa para o ProOps. Antes de começar, me diga:

1. **Nome da feature:** como se chama? (ex: "Exportar proposta para Excel")
2. **Escopo:** só frontend, só backend, ou full-stack?
3. **Nicho:** feature genérica, ou específica de `automacao_residencial` ou `cortinas`?
4. **Entidades:** quais coleções do Firestore serão criadas ou modificadas?
5. **Usuários afetados:** todos os tenants, só admins, ou roles específicos?
6. **Breaking change?** Existe dado no Firestore que precisa de migração?
7. **Integração externa?** Envolve Stripe, WhatsApp, PDF generation ou Google Calendar?

E as **quatro perguntas de acesso**, obrigatórias — se você não souber
responder, eu pergunto antes de codar (ver `.claude/rules/access-control.md`):

8. **Permissão de membro:** isto vira uma página que o master concede ou nega
   por membro? Qual `pageId`?
9. **Plano:** quais planos abrem isto — Starter, Pro, Enterprise? É vendável
   como add-on avulso?
10. **Conta free / modo demo:** uma conta gratuita navega isto em
    somente-leitura, ou o módulo fica fora do demo (como o fiscal)?
11. **Coleção nova no Firestore?** Precisa de regra explícita — a política é
    DENY-by-default.

Com essas respostas, vou seguir este fluxo:

## Fluxo de implementação

### 1. Tipos TypeScript (sempre primeiro)
- Definir interfaces em `src/types/` para o domínio da feature
- Tipos compartilhados com backend em `apps/functions/src/shared/` se necessário

### 2. Backend (se necessário)
- Criar/atualizar controller em `apps/functions/src/api/controllers/`
- Registrar rota em `apps/functions/src/api/routes/`
- Garantir: `tenantId` filtrado, inputs validados, `limit()` nas queries

### 3. Service frontend
- Adicionar função em `src/services/[recurso]-service.ts`
- Chama `/api/backend/[rota]` — nunca Firebase diretamente

### 4. Hook de dados
- Criar `src/hooks/use-[feature].ts` se necessário
- Encapsula chamada ao service + estado (loading, error, data)

### 5. Componentes de UI
- Verificar componentes Shadcn existentes em `src/components/ui/`
- Criar em `src/components/[dominio]/` ou `src/app/[rota]/_components/`
- Loading state, error state e empty state obrigatórios

### 6. Rota/Page (se necessário)
- Criar `src/app/[rota]/page.tsx` como Server Component quando possível
- Proteção de rota via `middleware.ts` se necessário

### 7. Camadas de acesso (se for módulo, ou página nova)

Percorrer `.claude/rules/access-control.md` inteiro. Resumo do que ele cobra:

- **Permissão:** `pageId` em `lib/permissions/pages.ts` + checagem no
  controller + `usePagePermission` na página + `permission` na ferramenta da Lia.
- **Plano:** capacidade em `PLAN_CATALOG` + `requirePlanCapability` na rota
  (por PREFIXO) + `UpgradeRequired` na página + `requiresCapability` no menu.
- **Demo:** as três listas (`DEMO_ACCESSIBLE_PREFIXES`,
  `DEMO_READABLE_PREFIXES`, `DEMO_BLOCKED_MUTATION_PREFIXES`) concordando —
  e o prefixo da API conferido contra o `app.use(...)` real.
- **Rules:** regra explícita para coleção nova.

### 8. Checklist pré-entrega
- [ ] TypeScript sem erros
- [ ] Multi-tenant: `tenantId` em todas as queries
- [ ] Sem secrets no frontend
- [ ] Sem `any`
- [ ] Feature de billing → revisão manual antes de deploy
- [ ] Novo schema Firestore → plano de migração
- [ ] As quatro camadas de acesso respondidas e **testadas** (o teste é o que
      impede o gap de voltar — ver a tabela em `access-control.md`)
