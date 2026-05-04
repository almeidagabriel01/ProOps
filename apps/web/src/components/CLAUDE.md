# CLAUDE.md — src/components/

## Estrutura
```
components/
├── ui/           # Shadcn/ui (Radix primitives) — GERADO, não editar manualmente
├── admin/        # Painéis e ferramentas de administração
├── auth/         # Login, registro, recuperação de senha
├── branding/     # Logo, identidade visual do tenant
├── charts/       # Gráficos (Recharts)
├── features/     # Features específicas do produto
├── landing/      # Página de landing/marketing
├── layout/       # Shell, navigation, sidebar, topbar
├── legal/        # Termos de uso, política de privacidade
├── notifications/# Sistema de notificações
├── onboarding/   # Fluxo de onboarding de novos tenants
├── pdf/          # Renderização de PDFs (usado server-side via Playwright)
├── profile/      # Perfil do usuário
├── shared/       # Componentes verdadeiramente genéricos
└── team/         # Gestão de equipe e permissões
```

## Regras

- Um componente por arquivo
- **Export nomeado** (não default export) para tree-shaking
- Props sempre tipadas com `interface [Nome]Props {}`
- Componentes de UI puro: sem chamadas a Firebase ou services — recebem dados via props
- Componentes "smart" (com lógica de dados): ficam em pastas de domínio, consomem hooks

## Shadcn/ui (`components/ui/`)
- **NUNCA** editar arquivos em `ui/` manualmente
- Para customizar: use `className` via `cn()` no ponto de uso
- Para adicionar novo componente: `npx shadcn@latest add [componente]`
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
