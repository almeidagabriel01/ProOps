# Skill: Novo Componente React

## Quando esta skill é invocada
Quando o usuário pede para criar um novo componente React.

## O que você faz

1. **Confirme o tipo de componente:**
   - É de UI puro (recebe dados via props) ou "smart" (busca dados)?
   - É Server Component ou Client Component (`'use client'`)?
   - É genérico (shared), de domínio específico, ou local de uma rota?
   - É niche-specific? (`automacao_residencial` | `cortinas`)

2. **Verifique se já existe algo similar:**
   ```bash
   find src/components -name "*.tsx" | head -50
   ls src/components/ui/
   ```

3. **Determine o path correto:**
   - Componente genérico reutilizável: `src/components/shared/nome-componente.tsx`
   - Componente de domínio: `src/components/[dominio]/nome-componente.tsx`
   - Componente local de rota: `src/app/[rota]/_components/nome-componente.tsx`
   - Domínios existentes: `admin`, `auth`, `branding`, `charts`, `features`, `landing`, `layout`, `legal`, `notifications`, `onboarding`, `pdf`, `profile`, `shared`, `team`

4. **Use este template:**

```typescript
// src/components/[dominio]/nome-componente.tsx
interface NomeComponenteProps {
  // props tipadas explicitamente
}

export function NomeComponente({ ...props }: NomeComponenteProps) {
  return (
    // JSX
  )
}
```

5. **Se for Client Component** (usa hooks, eventos, browser APIs):
```typescript
'use client'

import { useState } from 'react'

interface NomeComponenteProps {
  // props
}

export function NomeComponente({ ...props }: NomeComponenteProps) {
  // implementação
}
```

6. **Se for componente com dados (smart):**
   - Crie o hook associado em `src/hooks/use-[nome].ts`
   - O componente consome o hook, nunca chama Firebase ou services diretamente
   - Use `src/services/[recurso]-service.ts` no hook

7. **Para componentes Shadcn/ui extras:**
   ```bash
   npx shadcn@latest add [componente]
   # Isso adiciona em src/components/ui/ — não editar manualmente depois
   ```

8. **Checklist final:**
   - [ ] Export nomeado (não default export)
   - [ ] Props tipadas com interface explícita
   - [ ] Responsivo com Tailwind v4 (mobile-first)
   - [ ] Loading e error states se assíncrono
   - [ ] Sem `any` no TypeScript
   - [ ] Sem imports de Firebase ou services diretamente no componente
   - [ ] `'use client'` apenas se necessário
