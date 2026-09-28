---
name: ProOps, superfícies de venda do ERP
description: Papel branco e noite neutra, filete de 1px, Montserrat pesada com uma palavra em Playfair itálico e o próprio ERP desenhado em código.
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
  mock-surface: "#f5f5f4"
  mock-surface-2: "#ececea"
  mock-night: "#111113"
  signal-positive: "#15803d"
  signal-attention: "#b45309"
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
  mock:
    fontFamily: "Inter, var(--font-pdf-inter), ui-sans-serif, sans-serif"
    fontSize: "calc(var(--u) * 2.4)"
    fontWeight: 400
    lineHeight: 1.35
    fontFeature: "\"tnum\" 1, \"cv11\" 1"
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
  feature-row:
    textColor: "{colors.ink}"
    typography: "{typography.item-title}"
    rounded: "{rounded.frame}"
    padding: "20px 12px 20px 44px"
---

# Design System: ProOps, superfícies de venda do ERP

Escopo: este registro descreve as superfícies de MARKETING do ERP (a landing em `erp.proops.com.br`, `/funcionalidades` e as landings de nicho). A interface autenticada do ERP usa os tokens do shadcn em `src/app/globals.css` (`--background`, `--primary` e companhia, azulados) e fica fora daqui. O site institucional e a landing do aplicativo têm mundo próprio e também ficam fora.

## Overview

**Creative North Star: "A Prancheta de Linhas"**

A página é uma prancheta: papel branco de dia, noite neutra quase preta no tema escuro, e tudo o que se desenha nela é traço. Filete de 1px separa seções, a linha de 3px liga estações como num mapa de metrô, a cota com batentes mede o vão do nicho. Nada é ilustração decorativa; o que ocupa o espaço de imagem é o próprio ERP, redesenhado em HTML dentro de uma moldura de navegador ou de celular, com números reais do motor de preço.

A tipografia faz o contraste que a cor não faz. Montserrat em peso 700, apertada, carrega o título; uma única palavra dele cai em Playfair Display itálico, a palavra que sustenta a promessa ("recibo", "contador", "todas"). O corpo é neutro, em tinta a 60%, com medida curta. A cor só aparece numa landing de nicho, e mesmo ali como tinta de prancheta: a palavra do título, o ponto de prova, o trilho das etapas, a alça do controle de medida.

O movimento conta a história em vez de enfeitar: a linha se desenha, a estação acende, a parcela vira "Pago". Todo estado é escrito no fim da história, e a animação parte dele só quando o navegador e a preferência de movimento permitem.

**Key Characteristics:**
- Mono por padrão; cor por nicho entra só pela raiz `data-acento`.
- Título Montserrat 700 com uma palavra em Playfair itálico.
- Filete de 1px e linha de 3px como únicos elementos gráficos recorrentes.
- Telas do ERP codadas, dimensionadas pela largura da própria tela.
- Números tabulares em todo lugar que mostra valor, contagem ou medida.
- Estado final no HTML; movimento é camada opcional.

## Colors

Uma prancheta em preto e branco com tinta em opacidades fixas, e uma cor por nicho que só a landing daquele nicho usa.

### Primary
- **Tinta de Prancheta** (ink): título, texto forte, preenchimento do botão principal, estação ativa, linha do mapa. No tema escuro o papel dela passa ao **Branco Giz** (ink-on-night).

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
- **Superfícies da Réplica** (mock-surface, mock-surface-2, mock-night): paleta própria das telas codadas, para combinarem entre si nos dois temas.
- **Sinais da Réplica** (signal-positive, signal-attention): "Pago" e "Pendente" dentro das telas codadas; nunca fora delas.

### Named Rules
**The Mono Page Rule.** A home e `/funcionalidades` são preto e branco, sem exceção. Cor só existe numa página com `data-acento`, e ali só em cinco lugares: a palavra em itálico do herói, os pontos de prova, o trilho e os anéis das etapas, o controle de medida e o `--mk-acento` das telas codadas.

**The Opacity Ladder Rule.** Texto secundário é tinta em opacidade, não cinza novo: 100% para título, 75% para valor em destaque, 60% para parágrafo, 45% para rótulo, 40% para contagem, 10% a 15% para filete. No escuro, a mesma escada sobre o branco.

## Typography

**Display Font:** Montserrat (auto-hospedada como `--font-pdf-montserrat`, com sans-serif)
**Accent Font:** Playfair Display itálico (auto-hospedada como `--font-pdf-playfair`, com serif)
**Body Font:** pilha do sistema (`ui-sans-serif, system-ui, sans-serif`, o `font-sans` padrão do Tailwind)
**Mock Font:** Inter (`--font-pdf-inter`), só dentro das telas codadas

**Character:** Uma grotesca geométrica pesada e apertada contra uma serifada de alto contraste em itálico: a planilha técnica e a assinatura à mão no mesmo título.

### Hierarchy
- **Display** (700, 2.6rem no celular, 3.75rem de `sm`, 4.6rem de `lg`, 1.02, -0.035em): só o `h1` do herói. No nicho o topo é 4.25rem.
- **Closing** (700, 2.25rem no celular, 3.75rem de `md`, 1.05, -0.03em): a frase grande do fecho, centralizada.
- **Headline** (700, 2.1rem no celular, 3rem de `md`, 1.06, -0.025em): título de seção, alinhado à esquerda, `max-width` de 48rem.
- **Title** (700, 1.5rem a 1.85rem, -0.02em): título de capítulo em `/funcionalidades`; 1.125rem para a etapa do nicho.
- **Item title** (600, 17px, 1.375): o nome de um recurso ou de uma dor.
- **Lead** (400, 1.125rem, 1.625, tinta a 60%): o parágrafo do herói e da seção, até 42rem (cerca de 65ch).
- **Body** (400, 15px, 1.625, tinta a 60%): resumo e detalhe de recurso, até 42rem.
- **Label** (600, 11px a 13px, números tabulares): selo de plano, contagem, rótulo de painel. Caixa alta com 0.1em só como rótulo DENTRO de um painel de instrumento ("Proposta"), nunca acima de um título.
- **Mock** (Inter, escala `mk-t-1` a `mk-t-6` em múltiplos de `--u`): a tipografia das réplicas, medida contra a largura da tela.

### Named Rules
**The One Italic Word Rule.** Todo título é Montserrat 700 com no máximo uma palavra ou expressão curta em Playfair itálico peso 500 (o componente `Accent`). A palavra é a que carrega a promessa, e na landing de nicho ela veste o acento.

**The Tabular Figures Rule.** Valor, contagem, medida e número de etapa usam `tabular-nums`; as réplicas ligam `"tnum"` na raiz.

## Layout

Contêiner único de 1280px (`max-w-7xl`) com respiro lateral de 16px, 24px de `sm` para cima. A seção padrão tem 96px de altura de respiro vertical, 128px de `md`, e se separa da anterior por um filete de 1px no topo; não há faixas de fundo alternadas entre seções da vitrine. O herói desce 128px (160px de `md`) para passar da barra fixa.

Grades assimétricas em vez de colunas iguais: `/funcionalidades` abre com título e texto em 1.25fr / 0.75fr alinhados pela base, e o mapa de linhas ocupa a largura inteira logo abaixo; o nicho abre em 0.95fr / 1.05fr, título e ações à esquerda, a proposta na moldura à direita. Os capítulos têm um trilho de 280px fixo (`sticky`, 112px do topo) com busca, filtro de plano e índice, e a lista ao lado.

Ritmo interno: título a parágrafo 20px, parágrafo a ações 28px, cabeçalho de seção ao conteúdo 56px a 64px. Texto alinhado à esquerda em toda seção; centralizado só no fecho e no FAQ.

No celular o trilho de capítulos vira uma fileira de pílulas que rola na horizontal, o selo de plano desce para baixo do texto do recurso, a linha do mapa passa a ligar um terminal ao próximo na vertical e a jornada estática empilha. Breakpoints: `sm` 640px, `md` 768px, `lg` 1024px, mais `tela-baixa` (de `md` para cima com até 800px de altura).

## Elevation & Depth

A página é plana; a profundidade é reservada a objetos que representam coisas físicas: a janela do navegador, o celular, o painel de instrumento, a paleta de busca do FAQ e o botão principal. As sombras são longas, com espalhamento negativo, e ficam mais fundas e mais escuras no tema escuro. Hover de linha não levanta nada: tinge o fundo com 2,5% de tinta.

### Shadow Vocabulary
- **Janela** (`box-shadow: 0 24px 60px -32px rgba(0,0,0,0.28)`; escuro `0 40px 110px -40px rgba(0,0,0,0.85)`): a moldura de navegador com a tela codada.
- **Painel** (`box-shadow: 0 20px 50px -30px rgba(0,0,0,0.3)`; escuro `0 30px 70px -30px rgba(0,0,0,0.8)`): o painel de instrumento das cenas de nicho.
- **Paleta** (`box-shadow: 0 30px 80px -40px rgba(0,0,0,0.4)`, com `backdrop-filter: blur(24px)` sobre papel a 80%): o FAQ em forma de busca.
- **Botão** (`box-shadow: 0 8px 30px rgba(0,0,0,0.16)`): o botão principal em pílula.
- **Alça** (`box-shadow: 0 4px 12px -4px rgba(0,0,0,0.35)`): a alça do controle de medida.

### Named Rules
**The Physical Object Rule.** Sombra só em objeto que existe fora da tela (janela, celular, painel, botão). Seção, linha de lista, selo e título nunca têm sombra.

## Shapes

Três famílias de forma. Controle interativo é pílula (botão, selo de plano, filtro segmentado, campo de busca, índice no celular). Objeto contido tem canto de 12px (moldura de navegador, linha de recurso no hover) ou 16px (painel de instrumento, paleta do FAQ). O desenho é círculo e traço: estação de 13px com anel de 2.5px, vazia e preenchida quando aberta; anel de etapa de 16px com borda de 3px no acento; linha de metrô de 3px com ponta arredondada; filete de 1px; cota técnica de 1.2 de traço com batentes nas pontas. Dentro das réplicas, o raio é medido em `--u` (`mk-rounded-*`), nunca em px.

## Components

### Buttons
Tinta que sobe: o botão não se desloca; a cor enche de baixo para cima com uma linha d'água ondulada e o texto inverte.
- **Shape:** pílula (9999px).
- **Primary (`solid`):** preto com texto branco no claro, branco com texto preto no escuro; 12px por 28px, 14px semibold; o grande tem 16px por 32px e 18px. Seta à direita que anda 4px no hover.
- **Hover / Focus:** a tinta sobe em 0.55s com `cubic-bezier(0.65, 0, 0.35, 1)`; pressionar reduz a 98%; foco com anel de 2px a 30% de tinta e 2px de afastamento.
- **Inverted / onLight:** cores fixas para superfícies de fundo fixo, que não seguem o tema.
- **Link:** texto sem caixa, com sublinhado de 2px que se desenha da esquerda em 0.4s. É sempre a ação secundária ao lado da principal ("Marcar uma demonstração", "Falar com a gente").

### Chips
- **Selo de plano:** pílula com filete de 12%, 11.5px semibold, tinta a 75%; o complemento de add-on vai ao lado em 11px, tinta a 45%. Quando o filtro está num plano em que o recurso só entra por add-on, o selo principal cai para 40% e o de add-on passa à frente.
- **Filtro segmentado:** pílula com filete e 4px de respiro; o segmento escolhido é preenchido de tinta com texto invertido, os outros ficam em tinta a 60%. No nicho, o seletor de modo tem uma pílula preenchida que desliza em 0.3s.

### Cards / Containers
- **Moldura de navegador:** canto de 12px, filete, barra de cromo com três pontos e o endereço `erp.proops.com.br` em mono de 10px; sombra Janela.
- **Painel de instrumento:** canto de 16px, papel, filete, 16px de respiro, sombra Painel. Rótulo em caixa alta pequena, a lista da proposta e o total em Montserrat 700 animado.
- **Sem card de ícone.** Recurso, dor e módulo são linhas, não caixas; ver Do's and Don'ts.

### Inputs / Fields
- **Busca:** pílula de 44px, papel, filete de 12%, ícone de lupa a 40% à esquerda, 16px no celular e 14px de `md`.
- **Focus:** a borda sobe para 40% de tinta; sem brilho.
- **Controle de medida:** um `<input type="range">` nativo com trilho de 4px pintado no acento até `--pct` e alça de 22px com anel de 3px no acento; cresce a 118% ao arrastar.

### Navigation
- **Índice de capítulos:** no desktop, lista vertical com um fio de 1px à esquerda que cresce do centro no item corrente, contagem tabular à direita; no celular, pílulas roláveis, a corrente preenchida de tinta.
- **Estações que passam:** o fecho abre com uma faixa lenta com o nome de cada recurso, cada um precedido de um anel de 10px, como o painel de uma linha.

### Signature: Mapa de linhas
O topo de `/funcionalidades`: as categorias são linhas verticais de 3px pendendo de um tronco horizontal, os recursos são estações. Desenhado por keyframe de CSS porque está acima da dobra: o tronco corre em 1.1s, cada linha desce a partir do terminal dela com 60ms de escalonamento por coluna, as estações acendem com 40ms por linha. No hover de uma linha, as outras caem para 22%. A mesma linha continua nos capítulos, passando pelo terminal e pelas estações de cada recurso.

### Signature: Linha de recurso
Um `<details>` nativo: estação à esquerda sobre a linha do capítulo, ícone a 45%, nome, resumo, selo à direita e chevron. Aberto, a estação se preenche, a altura anima com `interpolate-size` onde existe, e aparecem os detalhes com traço de 8px no lugar do marcador, e os pares "No ERP", "Limite" e "Nos segmentos".

### Signature: Tela codada
A réplica do ERP em HTML (`.mock-tela` dentro de `.mock-caixa`): tipo, espaço e raio em múltiplos de `--u`, que vale 0.8cqw na tela de desktop e 1.85cqw na de celular, então a mesma réplica cabe numa janela de 640px e num celular de 260px. Paleta própria nos dois temas; `--mk-acento` herda o acento do nicho e cai para a tinta fora dele.

### Signature: Cena de nicho
Um desenho técnico em vista de elevação (vão, módulo, planta) no traço da tinta, com cotas que se desenham por recorte em 0.9s e peças que entram escalonadas em 90ms, ao lado do painel de instrumento. O controle de medida recalcula o total pelo motor de preço de verdade. Detalhes vivos (perfil que marcha, sensor que pulsa, cone de câmera que varre) param fora da tela e sob movimento reduzido.

## Do's and Don'ts

### Do:
- **Do** escrever todo título em Montserrat 700 com tracking negativo e, no máximo, uma palavra em Playfair itálico 500 pelo `Accent`.
- **Do** separar seções com filete de 1px a 10% de tinta e respiro de 96px (128px de `md`).
- **Do** mostrar o produto com telas codadas dentro de `JanelaDoErp` ou do celular, medidas em `--u`, com números do motor de preço.
- **Do** escrever o estado final no HTML e no CSS, e animar a partir dele; sob `prefers-reduced-motion` a cena mostra o fim da história (a parcela já paga, o traço inteiro).
- **Do** usar `cubic-bezier(0.22, 1, 0.36, 1)` para entradas e revelações, `cubic-bezier(0.65, 0, 0.35, 1)` para traços que se desenham e para a tinta do botão.
- **Do** colocar o acento de nicho só pela raiz `data-acento` e ler `--acento` a partir dela; nenhum componente recebe cor por prop.
- **Do** escrever "a ProOps", sempre no feminino, e pontuar com vírgula, dois-pontos e ponto e vírgula.

### Don't:
- **Don't** pôr kicker, eyebrow ou rótulo em caixa alta acima de um título de seção; o título abre a seção sozinho.
- **Don't** montar grade de cards com ícone, título e texto; recurso, dor e módulo são linhas em lista.
- **Don't** usar cor na home ou em `/funcionalidades`, nem mais de um acento numa landing de nicho.
- **Don't** usar travessão (U+2014) como pontuação em nenhum texto que vira tela.
- **Don't** usar foto de banco, ilustração de pessoas ou mockup em imagem raster no lugar da tela codada.
- **Don't** dar sombra a seção, linha de lista, selo ou título.
- **Don't** usar os verdes e âmbar de sinal fora das telas codadas.
- **Don't** medir dentro de uma réplica em px; tudo nela é múltiplo de `--u`.
