---
name: ProOps, superfícies de venda do ERP
description: Papel branco e noite neutra, filete de 1px, Montserrat pesada com uma palavra em Playfair itálico e prints de verdade do ERP.
colors:
  ink: "#000000"
  ink-muted: "rgb(0 0 0 / 0.6)"
  ink-faint: "rgb(0 0 0 / 0.45)"
  hairline: "rgb(0 0 0 / 0.1)"
  paper: "#ffffff"
  night: "#0a0a0a"
  night-deep: "#070707"
  night-raised: "#171717"
  ink-on-night: "#ffffff"
  ink-on-night-muted: "rgb(255 255 255 / 0.6)"
  hairline-night: "rgb(255 255 255 / 0.1)"
  frame-chrome: "#f5f5f5"
  niche-automacao-claro: "#4f46e5"
  niche-automacao-escuro: "#a5b4fc"
  niche-cortinas-claro: "#be185d"
  niche-cortinas-escuro: "#f9a8d4"
  niche-seguranca-claro: "#dc2626"
  niche-seguranca-escuro: "#f87171"
  niche-vidracaria-claro: "#0e7490"
  niche-vidracaria-escuro: "#67e8f9"
  niche-marcenaria-claro: "#8a5a2b"
  niche-marcenaria-escuro: "#d6a574"
typography:
  display:
    fontFamily: "Montserrat, var(--font-pdf-montserrat), sans-serif"
    fontSize: "4.6rem"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Montserrat, var(--font-pdf-montserrat), sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  closing:
    fontFamily: "Montserrat, var(--font-pdf-montserrat), sans-serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Montserrat, var(--font-pdf-montserrat), sans-serif"
    fontSize: "1.85rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  accent:
    fontFamily: "Playfair Display, var(--font-pdf-playfair), serif"
    fontWeight: 500
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  item-title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.375
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  button:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  key: "6px"
  frame: "12px"
  panel: "16px"
  pill: "9999px"
spacing:
  gutter: "16px"
  gutter-sm: "24px"
  stack-heading: "20px"
  stack-actions: "28px"
  stack-block: "56px"
  section: "96px"
  section-md: "128px"
  hero-top: "128px"
  hero-top-md: "160px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-primary-lg:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-inverted:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
  button-link:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    padding: "0"
  chip-plan-seal:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  segmented-filter:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-filter-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 6px"
  input-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 40px"
  browser-frame:
    backgroundColor: "{colors.frame-chrome}"
    rounded: "{rounded.frame}"
  instrument-panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
    padding: "16px"
  feature-card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: ProOps, superfícies de venda do ERP

Escopo: este registro descreve as superfícies de MARKETING do ERP (a landing em `erp.proops.com.br`, `/funcionalidades` com as páginas de cada funcionalidade, e as landings de nicho). A interface autenticada do ERP usa os tokens do shadcn em `src/app/globals.css` (`--background`, `--primary` e companhia, azulados) e fica fora daqui. O site institucional e a landing do aplicativo têm mundo próprio e também ficam fora.

## Overview

**Creative North Star: "A Prancheta de Linhas"**

A página é uma prancheta: papel branco de dia, noite neutra quase preta no tema escuro, e tudo o que se desenha nela é traço. Filete de 1px separa seções e as linhas de uma lista, a cota com batentes mede o vão do nicho. Nada é ilustração decorativa; o que ocupa o espaço de imagem é o próprio ERP, em prints de verdade tirados da demonstração de cada nicho, dentro de uma moldura de navegador ou de celular.

A tipografia faz o contraste que a cor não faz. Montserrat em peso 700, apertada, carrega o título; uma única palavra dele cai em Playfair Display itálico, a palavra que sustenta a promessa ("recibo", "contador", "todas"). O corpo é neutro, em tinta a 60%, com medida curta. A cor só aparece numa landing de nicho, e mesmo ali como tinta de prancheta: a palavra do título, o ponto de prova, o trilho das etapas, a alça do controle de medida.

O movimento conta a história em vez de enfeitar: a cota se desenha, a assinatura corre, a parcela vira "Pago". Todo estado é escrito no fim da história, e a animação parte dele só quando o navegador e a preferência de movimento permitem.

**Key Characteristics:**
- Mono por padrão; cor por nicho entra só pela raiz `data-acento`.
- Título Montserrat 700 com uma palavra em Playfair itálico.
- Filete de 1px como elemento gráfico recorrente; o conteúdo vem em linhas de lista, e card só existe para carregar o print de uma tela.
- Prints de verdade do ERP, refeitos por roteiro (`tests/capturas-do-erp`) quando a tela muda.
- Números tabulares em todo lugar que mostra valor, contagem ou medida.
- Estado final no HTML; movimento é camada opcional.

## Colors

Uma prancheta em preto e branco com tinta em opacidades fixas, e uma cor por nicho que só a landing daquele nicho usa.

### Primary
- **Tinta de Prancheta** (ink): título, texto forte, preenchimento do botão principal, ícone e seta da linha em hover. No tema escuro o papel dela passa ao **Branco Giz** (ink-on-night).

### Secondary (por nicho, uma por página)
Cada landing de nicho escreve `--acento-claro` e `--acento-escuro` na raiz e o CSS entrega `--acento`, que troca com o tema. Os valores moram em `src/lib/niches/definitions/<id>/landing.ts`, com teste de contraste.
- **Índigo de Automação** (niche-automacao-claro / -escuro): automação residencial.
- **Framboesa de Persiana** (niche-cortinas-claro / -escuro): persianas e toldos.
- **Vermelho de Alarme** (niche-seguranca-claro / -escuro): segurança eletrônica.
- **Ciano de Vidro** (niche-vidracaria-claro / -escuro): vidraçaria e esquadrias.
- **Nogueira** (niche-marcenaria-claro / -escuro): marcenaria e móveis planejados.

Derivados, sempre por `color-mix` a partir do acento: `--acento-suave` (12%, anel de foco do controle de medida) e `--acento-linha` (45%).

### Neutral
- **Papel** (paper): fundo de toda seção clara, fundo do painel de instrumento e do campo de busca.
- **Noite Neutra** (night): fundo de toda seção no tema escuro (`neutral-950`).
- **Noite Funda** (night-deep): só a faixa escura do herói da home (`.superficie-noite`), com luz ambiente radial estática.
- **Noite Elevada** (night-raised): moldura e painel no tema escuro.
- **Tinta Suave** (ink-muted): parágrafo de apoio, descrição de seção e de recurso.
- **Tinta Tênue** (ink-faint): rótulo de campo, contagem, ícone de linha, texto de segunda ordem.
- **Filete** (hairline / hairline-night): borda de seção, borda de painel, borda de selo e de filtro (entre 10% e 15% de tinta).
- **Cromo de Janela** (frame-chrome): barra da moldura de navegador.

### Named Rules
**The Mono Page Rule.** A home e `/funcionalidades` são preto e branco, sem exceção. Cor só existe numa página com `data-acento`, e ali só em quatro lugares: a palavra em itálico do herói, os pontos de prova, o trilho e os anéis das etapas e o controle de medida.

**The Opacity Ladder Rule.** Texto secundário é tinta em opacidade, não cinza novo: 100% para título, 75% para valor em destaque, 60% para parágrafo, 45% para rótulo, 40% para contagem, 10% a 15% para filete. No escuro, a mesma escada sobre o branco.

## Typography

**Display Font:** Montserrat (auto-hospedada como `--font-pdf-montserrat`, com sans-serif)
**Accent Font:** Playfair Display itálico (auto-hospedada como `--font-pdf-playfair`, com serif)
**Body Font:** pilha do sistema (`ui-sans-serif, system-ui, sans-serif`, o `font-sans` padrão do Tailwind)

**Character:** Uma grotesca geométrica pesada e apertada contra uma serifada de alto contraste em itálico: a planilha técnica e a assinatura à mão no mesmo título.

### Hierarchy
- **Display** (700, 2.6rem no celular, 3.75rem de `sm`, 4.6rem de `lg`, 1.02, -0.035em): só o `h1` do herói. No nicho o topo é 4.25rem.
- **Closing** (700, 2.25rem no celular, 3.75rem de `md`, 1.05, -0.03em): a frase grande do fecho, centralizada.
- **Headline** (700, 2.1rem no celular, 3rem de `md`, 1.06, -0.025em): título de seção, alinhado à esquerda, `max-width` de 48rem.
- **Title** (700, 1.125rem a 1.875rem, -0.02em): grupo e card em `/funcionalidades`, passo e recurso na página de cada uma, etapa do nicho.
- **Item title** (600, 17px, 1.375): o nome de um recurso ou de uma dor.
- **Lead** (400, 1.125rem, 1.625, tinta a 60%): o parágrafo do herói e da seção, até 42rem (cerca de 65ch).
- **Body** (400, 15px, 1.625, tinta a 60%): resumo e detalhe de recurso, até 42rem.
- **Label** (600, 11px a 13px, números tabulares): selo de plano, contagem, rótulo de painel. Caixa alta com 0.1em só como rótulo DENTRO de um painel de instrumento ("Proposta"), nunca acima de um título.

### Named Rules
**The One Italic Word Rule.** Todo título é Montserrat 700 com no máximo uma palavra ou expressão curta em Playfair itálico peso 500 (o componente `Accent`). A palavra é a que carrega a promessa, e na landing de nicho ela veste o acento.

**The Tabular Figures Rule.** Valor, contagem, medida e número de etapa usam `tabular-nums`.

## Layout

Contêiner único de 1280px (`max-w-7xl`) com respiro lateral de 16px, 24px de `sm` para cima. A seção padrão tem 96px de altura de respiro vertical, 128px de `md`, e se separa da anterior por um filete de 1px no topo; não há faixas de fundo alternadas entre seções da vitrine. O herói desce 128px (160px de `md`) para passar da barra fixa.

A seção "Recursos da plataforma" da home tem o título fixo à esquerda (0.85fr) e a lista numerada à direita (1.15fr). `/funcionalidades` abre com o título na largura e, abaixo, o texto à esquerda e os atalhos dos grupos à direita; cada grupo abre com o título e uma frase na mesma linha, e os cards vêm numa grade de três colunas (duas de `sm`). A página de uma funcionalidade abre com o texto numa coluna de 48rem e o print na largura inteira logo abaixo; o print de celular fica à direita do texto. Passos e recursos incluídos são linhas em colunas de larguras diferentes. O nicho abre em 0.95fr / 1.05fr, título e ações à esquerda, o print da proposta à direita.

Ritmo interno: título a parágrafo 20px, parágrafo a ações 28px, cabeçalho de seção ao conteúdo 56px a 64px. Texto alinhado à esquerda em toda seção; centralizado só no fecho e no FAQ.

No celular os cards empilham, e o print da página de funcionalidade desce para baixo do texto. Breakpoints: `sm` 640px, `md` 768px, `lg` 1024px, mais `tela-baixa` (de `md` para cima com até 800px de altura).

## Elevation & Depth

A página é plana; a profundidade é reservada a objetos que representam coisas físicas: a janela do navegador, o celular, o painel de instrumento, a paleta de busca do FAQ e o botão principal. As sombras são longas, com espalhamento negativo, e ficam mais fundas e mais escuras no tema escuro. Hover de linha não levanta nada: tinge o fundo com 2,5% de tinta.

### Shadow Vocabulary
- **Janela** (`box-shadow: 0 24px 60px -32px rgba(0,0,0,0.28)`; escuro `0 40px 110px -40px rgba(0,0,0,0.85)`): a moldura de navegador com o print do ERP.
- **Card** (`box-shadow: 0 24px 50px -30px rgba(0,0,0,0.35)`, só no hover): o card de funcionalidade.
- **Painel** (`box-shadow: 0 20px 50px -30px rgba(0,0,0,0.3)`; escuro `0 30px 70px -30px rgba(0,0,0,0.8)`): o painel de instrumento das cenas de nicho.
- **Paleta** (`box-shadow: 0 30px 80px -40px rgba(0,0,0,0.4)`, com `backdrop-filter: blur(24px)` sobre papel a 80%): o FAQ em forma de busca.
- **Botão** (`box-shadow: 0 8px 30px rgba(0,0,0,0.16)`): o botão principal em pílula.
- **Alça** (`box-shadow: 0 4px 12px -4px rgba(0,0,0,0.35)`): a alça do controle de medida.

### Named Rules
**The Physical Object Rule.** Sombra só em objeto que existe fora da tela (janela, celular, painel, botão) e no card em hover. Seção, linha de lista, selo e título nunca têm sombra.

## Shapes

Três famílias de forma. Controle interativo é pílula (botão, seletor de modo, atalho de grupo, campo de busca do FAQ). Objeto contido tem canto de 12px (moldura de navegador, ícone da lista da home) ou 16px (card de funcionalidade, painel de instrumento, paleta do FAQ). O desenho é círculo e traço: anel de etapa de 16px com borda de 3px no acento; filete de 1px; cota técnica de 1.2 de traço com batentes nas pontas.

## Components

### Buttons
Tinta que sobe: o botão não se desloca; a cor enche de baixo para cima com uma linha d'água ondulada e o texto inverte.
- **Shape:** pílula (9999px).
- **Primary (`solid`):** preto com texto branco no claro, branco com texto preto no escuro; 12px por 28px, 14px semibold; o grande tem 16px por 32px e 18px. Seta à direita que anda 4px no hover.
- **Hover / Focus:** a tinta sobe em 0.55s com `cubic-bezier(0.65, 0, 0.35, 1)`; pressionar reduz a 98%; foco com anel de 2px a 30% de tinta e 2px de afastamento.
- **Inverted / onLight:** cores fixas para superfícies de fundo fixo, que não seguem o tema.
- **Link:** texto sem caixa, com sublinhado de 2px que se desenha da esquerda em 0.4s. É sempre a ação secundária ao lado da principal ("Marcar uma demonstração", "Falar com a gente").

### Chips
- **Selo de plano:** texto de 13px semibold, tinta a 70%, na coluna da direita da linha; o complemento de add-on vai logo abaixo, tinta a 55%. Derivado do catálogo de planos, nunca escrito à mão.
- **Atalho de grupo:** pílula com filete de 12%, 14px, tinta a 70%; no hover a borda e o texto vão à tinta cheia.
- **Seletor de modo (nicho):** pílula com filete e 4px de respiro; uma pílula preenchida desliza em 0.3s até o modo escolhido, com o texto invertido.

### Cards / Containers
- **Moldura de navegador:** canto de 12px, filete, barra de cromo com três pontos e o endereço `erp.proops.com.br` em mono de 10px; sombra Janela.
- **Painel de instrumento:** canto de 16px, papel, filete, 16px de respiro, sombra Painel. Rótulo em caixa alta pequena, a lista da proposta e o total em Montserrat 700 animado.
- **Card de funcionalidade:** canto de 16px, filete, papel; o print da tela no topo, em 16:10 (o de celular de pé, centralizado, com borda de aparelho), o nome com o ícone, a explicação e o plano, e a seta. O nome é o link e cobre o card com um `::after`. No hover a borda escurece, surge a sombra Card e o print sobe 3% de escala. É o único card do sistema, e existe porque carrega uma tela de verdade: card com ícone, título e texto continua fora.

### Inputs / Fields
- **Busca:** pílula de 44px, papel, filete de 12%, ícone de lupa a 40% à esquerda, 16px no celular e 14px de `md`.
- **Focus:** a borda sobe para 40% de tinta; sem brilho.
- **Controle de medida:** um `<input type="range">` nativo com trilho de 4px pintado no acento até `--pct` e alça de 22px com anel de 3px no acento; cresce a 118% ao arrastar.

### Navigation
- **Atalhos de grupo:** no topo de `/funcionalidades`, âncoras em pílula para Vender, Entregar, Receber e Gerir a empresa.
- **Nomes que passam:** o fecho da lista abre com uma faixa lenta com o nome de cada funcionalidade, cada um precedido de um anel de 10px.
- **Volta à lista:** a página de uma funcionalidade abre com "Todas as funcionalidades" e fecha com "Continue por aqui", os cards de outras funcionalidades.
- **Funcionalidades na navbar:** rola até "Recursos da plataforma" na home (`#recursos`), e não abre outra página; a lista completa abre pelo botão no fim da seção.

### Signature: Lista dos principais
"Recursos da plataforma", na home: cinco linhas numeradas (01 a 05 a 30% de tinta), com o ícone num quadrado de 48px e canto de 12px, o nome e a frase, e a seta. A linha inteira é o link. No hover o fundo tinge 2,5%, uma barra de 3px cresce à esquerda, o quadrado do ícone se enche de tinta e sobe 2px. É o formato que a seção sempre teve, mantido a pedido do dono do produto, com o rótulo "Recursos da plataforma" acima do título.

### Signature: Print do ERP
A tela de verdade (`lib/landing/capturas.ts`, componente `CapturaDoErp`), tirada por `tests/capturas-do-erp` de emuladores próprios, com a demonstração de cada nicho no papel de empresa de exemplo. A de desktop vai numa janela de navegador que segue o tema; a de celular, num aparelho com a faixa de status em cima, para o entalhe não cobrir o cabeçalho. Sempre com legenda dizendo que é tela real com dados de exemplo. Quando a tela muda, o print é refeito pelo roteiro, nunca retocado.

### Signature: Página de funcionalidade
O nome da funcionalidade como título, a promessa logo abaixo em Montserrat com o termo em itálico, e o print da tela dela; depois "Como funciona" em três linhas numeradas (o número em Montserrat a 25% de tinta), "O que vem incluído" com cada recurso do catálogo em três colunas (nome e onde fica no ERP; resumo e detalhes com traço de 12px no lugar do marcador; plano, add-on, limite e exemplo aberto) e "Continue por aqui". Uma só página gerada para todas (`[slug]`), com o print escolhido por um `Record` que não compila se faltar um.

### Signature: Cena de nicho
Um desenho técnico em vista de elevação (vão, módulo, planta) no traço da tinta, com cotas que se desenham por recorte em 0.9s e peças que entram escalonadas em 90ms, ao lado do painel de instrumento. O controle de medida recalcula o total pelo motor de preço de verdade. Detalhes vivos (perfil que marcha, sensor que pulsa, cone de câmera que varre) param fora da tela e sob movimento reduzido.

## Do's and Don'ts

### Do:
- **Do** escrever todo título em Montserrat 700 com tracking negativo e, no máximo, uma palavra em Playfair itálico 500 pelo `Accent`.
- **Do** separar seções com filete de 1px a 10% de tinta e respiro de 96px (128px de `md`).
- **Do** mostrar o produto com prints de verdade do ERP (`CapturaDoErp`), com a legenda de tela real e dados de exemplo.
- **Do** escrever o estado final no HTML e no CSS, e animar a partir dele; sob `prefers-reduced-motion` a cena mostra o fim da história (a parcela já paga, o traço inteiro).
- **Do** usar `cubic-bezier(0.22, 1, 0.36, 1)` para entradas e revelações, `cubic-bezier(0.65, 0, 0.35, 1)` para traços que se desenham e para a tinta do botão.
- **Do** colocar o acento de nicho só pela raiz `data-acento` e ler `--acento` a partir dela; nenhum componente recebe cor por prop.
- **Do** escrever "a ProOps", sempre no feminino, e pontuar com vírgula, dois-pontos e ponto e vírgula.

### Don't:
- **Don't** pôr kicker, eyebrow ou rótulo em caixa alta acima de um título de seção nas páginas novas; o título abre a seção sozinho. As seções da home que já tinham o rótulo o mantêm, e "Recursos da plataforma" o manteve a pedido do dono do produto.
- **Don't** montar grade de cards com ícone, título e texto; recurso, dor e módulo são linhas em lista, e o único card é o que carrega o print de uma tela.
- **Don't** usar cor na home ou em `/funcionalidades`, nem mais de um acento numa landing de nicho.
- **Don't** usar travessão (U+2014) como pontuação em nenhum texto que vira tela.
- **Don't** usar foto de banco, ilustração de pessoas, tela desenhada ou mockup que finja ser o ERP; a tela é sempre o print de verdade.
- **Don't** dar sombra a seção, linha de lista, selo ou título.
