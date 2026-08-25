# CLAUDE.md — src/components/

## Estrutura
```
components/
├── ui/           # Shadcn/ui (Radix primitives) — GERADO, não editar manualmente
├── admin/        # Painéis e ferramentas de administração
├── auth/         # Login, registro, recuperação de senha
├── billing/      # Componentes de faturamento, planos e add-ons
├── branding/     # Logo, identidade visual do tenant
├── charts/       # Gráficos (Recharts)
├── features/     # Features específicas do produto (inclui team/team-management)
├── landing/      # Página de landing/marketing
├── layout/       # Shell, navigation, sidebar, topbar
├── legal/        # Termos de uso, política de privacidade
├── lia/          # Componentes da IA Lia (chat, widgets)
├── notifications/# Sistema de notificações
├── observability/# Painéis de observabilidade (superadmin)
├── onboarding/   # Fluxo de onboarding de novos tenants
├── pdf/          # Renderização de PDFs (usado server-side via Playwright)
├── profile/      # Perfil do usuário
├── seo/          # JSON-LD e schemas de SEO
└── shared/       # Componentes verdadeiramente genéricos
```

## Regras

- Um componente por arquivo
- **Export nomeado** (não default export) para tree-shaking
- Props sempre tipadas com `interface [Nome]Props {}`
- Componentes de UI puro: sem chamadas a Firebase ou services — recebem dados via props
- Componentes "smart" (com lógica de dados): ficam em pastas de domínio, consomem hooks

## Shadcn/ui (`components/ui/`)
- Arquivos **gerados pelo shadcn** (button, card, dialog, sheet, input, textarea,
  table, dropdown-menu...): não editar para customizar um uso pontual — use
  `className` via `cn()` no ponto de uso.
  Exceção: correção **transversal** que teria de ser repetida em dezenas de call
  sites (ex.: o bottom sheet mobile do `DialogContent`, o `text-base md:text-sm`
  de `input`/`textarea` que evita o zoom do iOS). Nesses casos a edição deve ser
  **aditiva e com guarda de breakpoint**, preservando o comportamento desktop.
- `ui/` também abriga componentes **próprios do projeto**, que não vêm do
  registry e são editados normalmente: `data-table.tsx`, `step-wizard.tsx`,
  `dock.tsx`, `command-palette.tsx`, `form-components.tsx`, `date-picker.tsx`,
  `upgrade-modal.tsx`, entre outros.
- Para adicionar novo componente do registry: `npx shadcn@latest add [componente]`
- Componentes disponíveis incluem: button, card, dialog, alert-dialog, badge, checkbox, avatar, command-palette, e muitos outros

## Nomenclatura
- Arquivo: `nome-componente.tsx` (kebab-case)
- Componente: `NomeComponente` (PascalCase)
- Props interface: `NomeComponenteProps`
- Hook associado: `useNomeComponente` em `src/hooks/`

## Multi-niche
Para features que variam por nicho de negócio, use `useCurrentNicheConfig()` do hook
em `src/hooks/useCurrentNicheConfig.ts`. Nichos: `automacao_residencial` | `cortinas`.
Nunca hardcodar strings de nicho em componentes genéricos.

## Antes de criar um componente novo
1. Verificar `ui/` — pode já existir um primitivo Shadcn
2. Verificar pasta de domínio — pode já existir algo similar
3. Verificar `shared/` — pode ser genérico o suficiente para estar lá
