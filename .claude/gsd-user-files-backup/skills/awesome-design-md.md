---
name: awesome-design-md
description: Use quando o usuário pedir para gerar UI inspirado em um brand (ex: "estilo Stripe", "componente no estilo Linear"), criar um DESIGN.md para o projeto, baixar um sistema de design da coleção awesome-design-md, ou usar tokens de design de uma marca conhecida. Triggers: "estilo [brand]", "design system", "DESIGN.md", "inspirado em [site]", "tokens de design".
---

# awesome-design-md

Skill para usar a coleção [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — 70+ DESIGN.md files de sistemas de design inspirados em marcas reais. Baixe um, jogue no projeto e peça ao agente para gerar UI combinando.

## Quando usar

- Usuário quer UI "no estilo Stripe / Linear / Figma / Vercel / etc."
- Usuário pede para criar ou atualizar um `DESIGN.md` do projeto
- Usuário quer aplicar tokens de design de uma marca conhecida em componentes

## Brands disponíveis

| Categoria | Brands |
|-----------|--------|
| AI & LLM | Claude, Cohere, ElevenLabs, Mistral AI, Ollama, Replicate, RunwayML, Together AI, xAI |
| Dev Tools | Cursor, Expo, Lovable, Raycast, Superhuman, Vercel, Warp |
| Backend/DB | ClickHouse, Composio, HashiCorp, MongoDB, PostHog, Sanity, Sentry, Supabase |
| Produtividade | Cal.com, Intercom, Linear, Mintlify, Notion, Resend, Zapier |
| Design Tools | Airtable, Clay, Figma, Framer, Miro, Webflow |
| Fintech | Binance, Coinbase, Kraken, Mastercard, Revolut, Stripe, Wise |
| E-commerce | Airbnb, Meta, Nike, Shopify, Starbucks |
| Mídia | Apple, IBM, NVIDIA, Pinterest, PlayStation, SpaceX, Spotify, The Verge, Uber, WIRED |
| Automotivo | BMW, Bugatti, Ferrari, Lamborghini, Renault, Tesla |

## Workflow 1: Baixar e usar um DESIGN.md de brand

Quando o usuário pedir UI "no estilo [brand]":

1. Identificar o slug do brand (ex: `stripe`, `linear`, `vercel`, `notion`)
2. Usar o CLI para baixar:
   ```bash
   npx getdesign@latest add <slug>
   ```
   Isso cria `DESIGN.md` na raiz do projeto.
3. Informar o usuário que o DESIGN.md foi adicionado e perguntar quais componentes quer gerar.
4. Ao gerar os componentes, referenciar o DESIGN.md para extrair:
   - Paleta de cores (primary, accent, neutral, surfaces)
   - Tipografia (font families, scale)
   - Spacing e border-radius
   - Sombras e elevação
   - Padrões de componentes (buttons, cards, inputs)

## Workflow 2: Criar DESIGN.md do próprio projeto

Quando o usuário pedir um DESIGN.md para documentar o design system do ProOps:

1. Analisar os componentes existentes em `src/components/` e `src/app/`
2. Extrair tokens do CSS global (Tailwind v4, CSS variables)
3. Gerar um `DESIGN.md` com as 9 seções padrão:
   - Visual Theme & Atmosphere
   - Color Palette & Roles
   - Typography Rules
   - Component Stylings
   - Layout Principles
   - Depth & Elevation
   - Interaction & Motion
   - Responsive Behavior
   - Agent Prompt Guide

## Workflow 3: Aplicar design tokens em componentes

Quando o usuário tiver um DESIGN.md e quiser gerar componentes:

1. Ler o `DESIGN.md` na raiz do projeto
2. Extrair os tokens relevantes para o componente solicitado
3. Gerar o componente usando Tailwind v4 CSS variables que mapeiem os tokens
4. Seguir as convenções do projeto (`src/components/`, kebab-case, named exports, `cn()`)

## Slugs de instalação comuns

| Brand | Comando |
|-------|---------|
| Stripe | `npx getdesign@latest add stripe` |
| Vercel | `npx getdesign@latest add vercel` |
| Linear | `npx getdesign@latest add linear` |
| Notion | `npx getdesign@latest add notion` |
| Figma | `npx getdesign@latest add figma` |
| Supabase | `npx getdesign@latest add supabase` |
| Sentry | `npx getdesign@latest add sentry` |
| Spotify | `npx getdesign@latest add spotify` |

Para ver todos os disponíveis: https://getdesign.md

## Notas

- O DESIGN.md gerado pelo CLI vai para a raiz do projeto. Pode ser movido para `.claude/references/` se preferir manter organizado.
- O ProOps usa Tailwind v4 (CSS-based config) — ao aplicar tokens, use CSS custom properties em `src/app/globals.css`.
- Adicione o `DESIGN.md` ao `.gitignore` se for temporário; deixe versionado se for o design system oficial do projeto.
