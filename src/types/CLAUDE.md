# CLAUDE.md — src/types/

## Responsabilidade
Tipos TypeScript globais e interfaces de domínio do projeto.

## Arquivos existentes
```
types/
├── index.ts              # Re-exports principais
├── proposal.ts           # Tipos de propostas e items
├── pdf.types.ts          # Tipos para geração/exibição de PDF
├── pdf-display-settings.ts
├── plan.ts               # Tipos de planos e features
├── automation.ts         # Tipos de automação residencial
├── calendar.ts           # Tipos de eventos de calendário
├── notification.ts       # Tipos de notificações
├── shared-proposal.ts    # Tipos de propostas compartilhadas (públicas)
└── declarations.d.ts     # Declarações de módulos externos
```

## Regras

- Tipos de domínio (entidades de negócio): `interface` com comentários JSDoc quando não óbvios
- Unions, utilitários, mapped types: `type`
- Enums: **evitar** — usar `as const` objects no lugar:
  ```typescript
  // Não: enum Status { Active = 'active' }
  // Sim:
  export const STATUS = { Active: 'active', Inactive: 'inactive' } as const
  export type Status = typeof STATUS[keyof typeof STATUS]
  ```
- **Nunca** importar tipos do Firebase (`DocumentData`, `Timestamp`) diretamente nos tipos de domínio — mapeie para seus próprios tipos
- Timestamps do Firestore: mapear para `Date` ou `string` nas interfaces de domínio

## Padrão de interface de domínio
```typescript
export interface NomeDominio {
  id: string
  tenantId: string        // obrigatório em todo documento Firestore
  createdAt: Date | string
  updatedAt?: Date | string
  // campos do domínio...
}
```

## Multi-niche
Para tipos que variam por nicho, usar union discriminada:
```typescript
export type NicheConfig = AutomacaoConfig | CortinasConfig
// com campo discriminante: type: 'automacao_residencial' | 'cortinas'
```

## Ao adicionar novos tipos
1. Verificar se já existe tipo similar nos arquivos acima
2. Adicionar no arquivo de domínio existente ou criar novo se for domínio novo
3. Re-exportar em `index.ts` se for usado amplamente
