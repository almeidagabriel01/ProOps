---
version: 1
slug: "apps-web-src-app-funcionalidades"
primary_target: "apps/web/src/app/funcionalidades"
related_targets: ["apps/web/src/components/landing/landing-features.tsx","apps/web/src/components/landing/niche"]
---

# Superfícies de venda do ERP: /funcionalidades, "Recursos" da home e as landings de nicho

Modo: Persuade. Público e provas: ver PRODUCT.md (sem depoimentos, logos ou números de uso).
Mundo: o incumbente da home do ERP (preto e branco premium, Montserrat com uma palavra em
Playfair itálico, filetes, cenas sticky com GSAP). Extensão, não troca de mundo. As telas do ERP
são prints de verdade (`tests/capturas-do-erp`), a pedido do usuário: nada de tela desenhada.
Nas superfícies novas não há eyebrow acima de título. Nichos ganham um acento de cor próprio.

## Direction contract

THESIS: provar o caminho inteiro (orçamento, obra, parcela, nota, pós-venda) com o próprio produto
funcionando, e recusar a grade de cards de ícone com título e texto que toda página de SaaS repete.

OWN-WORLD: papel branco e noite neutro-950, filete de 1px, Montserrat pesada com um termo em
Playfair itálico, números tabulares, prints de verdade do ERP dentro de moldura de navegador ou
celular; nos nichos, traço técnico (cotas, hachura, vista em elevação) no acento do nicho.

STORY: na home, "Funcionalidades" da navbar rola até "Recursos da plataforma", que cita as cinco
principais; cada uma, e cada card de "Ver todas", abre a página dela: o nome, o print da tela, como
funciona e o que vem incluído, com o plano. Daí o visitante cria a conta ou marca a demonstração.

FIRST VIEWPORT: /funcionalidades abre com o título, uma frase e os atalhos dos quatro grupos, e os
cards começam logo abaixo; a página de uma funcionalidade abre com o nome, a promessa e o CTA, e o
print da tela logo abaixo; o nicho abre em duas colunas, com o print da proposta à direita.

FORM: a home volta ao formato de lista que a seção sempre teve (título fixo à esquerda, cinco
linhas numeradas à direita, "Ver todas as funcionalidades" embaixo); /funcionalidades em cards com
o print de verdade de cada tela, agrupados pela ordem da venda; uma página por funcionalidade;
instrumento de medição interativo em cada nicho. Tudo ditado pelo usuário em 2026-09-28: o mapa
de metrô e a jornada animada da primeira versão contavam a história e ficaram difíceis de
entender, o palco de telas da home saiu para a lista voltar a ser como antes, e as telas
desenhadas em código deram lugar a prints do ERP.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
