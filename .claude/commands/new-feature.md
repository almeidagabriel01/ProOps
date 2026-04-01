# /new-feature

Vou implementar uma nova feature completa para o ProOps. Antes de começar, me diga:

1. **Nome da feature:** como se chama? (ex: "Exportar proposta para Excel")
2. **Escopo:** só frontend, só backend, ou full-stack?
3. **Nicho:** feature genérica, ou específica de `automacao_residencial` ou `cortinas`?
4. **Entidades:** quais coleções do Firestore serão criadas ou modificadas?
5. **Usuários afetados:** todos os tenants, só admins, ou roles específicos?
6. **Breaking change?** Existe dado no Firestore que precisa de migração?
7. **Integração externa?** Envolve Stripe, WhatsApp, PDF generation ou Google Calendar?

Com essas respostas, vou seguir este fluxo:

## Fluxo de implementação

### 1. Tipos TypeScript (sempre primeiro)
- Definir interfaces em `src/types/` para o domínio da feature
- Tipos compartilhados com backend em `functions/src/shared/` se necessário

### 2. Backend (se necessário)
- Criar/atualizar controller em `functions/src/api/controllers/`
- Registrar rota em `functions/src/api/routes/`
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

### 7. Checklist pré-entrega
- [ ] TypeScript sem erros
- [ ] Multi-tenant: `tenantId` em todas as queries
- [ ] Sem secrets no frontend
- [ ] Sem `any`
- [ ] Feature de billing → revisão manual antes de deploy
- [ ] Novo schema Firestore → plano de migração
