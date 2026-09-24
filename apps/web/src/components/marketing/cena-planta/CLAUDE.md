# CLAUDE.md — a cena da planta

## O que é

A cena longa da landing do ERP: uma casa em axonometria em que ambientes são
especificados, viram itens com preço, montam uma proposta, o cliente assina e o
pagamento nasce lançado no financeiro. Ela entra pela seção
`components/landing/landing-cena-planta.tsx` ("Conheça a plataforma ProOps"),
que substituiu um carrossel de três vídeos.

**A seção é da landing, o escuro é do PALCO.** A cena chegou aqui com a casca
do site da empresa (faixa escura de ponta a ponta, sobrancelha colorida, título
em Bricolage) no meio de uma página branca, com título em Montserrat e uma
palavra em Playfair itálico. Hoje o cabeçalho é o `SectionHeading` de todas as
outras seções, e os tokens da noite (`.superficie-noite`) moram no palco, que é
uma maquete iluminada, com moldura arredondada e filete. Os tokens não podem
subir para o `[data-cena-planta]`: aquilo é a trilha inteira de 300vh, e
pintaria uma faixa escura atrás da moldura.

**Ela nasceu como herói do site da empresa e mudou de endereço.** O motivo está
escrito em `app/(empresa)/institucional/_components/heroi/heroi-raiz.tsx`: no
site institucional ela respondia "como o sistema funciona", que é pergunta da
landing do produto, e mostrava a ProOps pelo exemplo de um nicho só. Aqui as
duas coisas viraram vantagem.

## Um dado, uma função pura, dois renderizadores

| Peça | O que é |
|---|---|
| `dados.ts` | a casa como dado: cômodos, paredes, móveis, janelas, itens em centavos, a proposta de exemplo e os NICHOS |
| `projecao.ts` | a isometria, pura: `projeta`, `desprojetaNoPiso`, a câmera e o frustum do three |
| `desenho.ts` | a ordem de desenho do SVG, por ordenação topológica (o SVG não tem z-buffer) |
| `roteiro.ts` | `estadoDaCena(p, realce)`: o que está na tela em cada ponto da rolagem, e `paraVariaveis`, o ÚNICO serializador para CSS |
| `planta-svg.tsx` / `three/cena-3d.ts` | os dois renderizadores da mesma casa, com as MESMAS medidas (o pendente é o caso mais visível: cúpula, boca e lâmpada na mesma altura nos dois, senão a troca no meio da cena entrega o truque) |
| `camadas-da-cena.tsx` | as legendas, a proposta e a divisão do pagamento, em HTML por cima dos dois |
| `diretor.tsx` | liga rolagem e ponteiro ao roteiro, escrevendo variáveis na raiz da cena |
| `seletor-de-nicho.tsx` | troca `data-nicho`; quem troca os rótulos é o CSS |

- **A câmera só faz zoom e pan.** Numa projeção ortográfica os dois são afins em
  2D, então o `transform` do SVG e o `OrthographicCamera` do three dão o mesmo
  quadro por construção (`__tests__/projecao.test.ts` confere contra o three).
  Girar a câmera exigiria reprojetar o SVG por quadro, e ele existe justamente
  para não ter JavaScript por quadro no celular.
- **O código da proposta vem do produto** (`buildProposalCodePreview`), e todo
  valor passa por um formatador só (`formataReais`).
- **A história termina no financeiro.** O último ato é a entrada e as parcelas
  lançadas; o aplicativo tem página própria e não entra aqui.

## A troca de nicho é CSS, não remontagem

Cada item tem um rótulo por nicho no HTML, e a regra
`[data-nicho="x"] [data-rotulo-de="x"] { display: block }` mostra o do nicho
ativo. Trocar de aba no meio da rolagem reescreve a proposta sem desmontar nó
nenhum, e o chip que está voando continua voando.

O que muda entre nichos é SÓ o rótulo: cômodos, preços, cortinas e a conta são
os mesmos, porque a tese da seção é exatamente essa (muda o catálogo e as
palavras, não a base). `marcenaria` não é um nicho configurado no produto
(`lib/niches/config.ts` tem dois); é o exemplo de um nicho novo, e a nota
embaixo das abas diz isso.

**Num teste, rótulo escondido continua no `textContent`.** `toContainText` lê
`textContent` e enxerga o que está em `display: none`, então a asserção é de
VISIBILIDADE (`toBeVisible` / `toBeHidden`), nunca de texto.

## As duas regras da primeira dobra valem aqui inteiras

- **A cena é escrita no estado FINAL.** `estilo-da-cena.tsx` escreve, no
  servidor, `estadoDaCena(1)` como regra BASE e `estadoDaCena(0)` só dentro de
  `prefers-reduced-motion: no-preference`. Quem pede menos movimento vê o quadro
  final composto, e o bloco de movimento reduzido do globals.css tira a trilha de
  300vh e empilha as camadas no fluxo.
- **O diretor começa tarde e não usa estado React.** O ScrollTrigger nasce no
  primeiro `idle` ou no primeiro gesto; a rolagem passa por uma mola que para
  sozinha, e a cada quadro só as variáveis que mudaram são escritas.

O item da proposta É o chip que voa: o `<li>` repousa na linha dele e o diretor
o desloca até o ambiente, medindo a posição de repouso por
`offsetTop`/`offsetLeft` (que ignoram transform) no resize, nunca na rolagem.
Por isso a folha não tem `opacity` própria: ela apagaria os chips junto.

## A casa nunca passa por cima de texto

O palco tem texto em três lugares: as abas de nicho e a nota delas (em cima, à
esquerda), a legenda do ato com o trilho (embaixo, à esquerda) e, depois, a
proposta (à direita). As abas são botões translúcidos, e uma casa passando por
trás delas aparece ATRAVÉS delas; foi assim que o defeito foi reportado, no
notebook e no celular. A regra é: nenhum desenho da casa debaixo de texto, em
nenhum ato, em nenhum tamanho. Quem garante é o E2E
(`tests/e2e/landing/cena-da-planta.spec.ts`, "a casa e o texto"), que varre a
cena inteira em quatro tamanhos e consulta `elementsFromPoint` em pontos dentro
de cada texto.

A cena foi desenhada numa tela de 1440x900, e cada tela menor achou um jeito de
quebrá-la. Três lições, uma por defeito:

- **No desktop a separação é pela LARGURA.** Em repouso a casa mora na raia à
  direita da coluna de texto (`--coluna-texto`, derivada da mesma caixa
  `max-w-7xl px-10` das camadas) e usa a altura inteira abaixo da barra.
  Reservar as faixas de texto na largura toda, que foi a primeira tentativa,
  deixava a casa com um terço do tamanho num notebook e seis chips empilhados
  em cima dela.
- **O recuo é MEDIDO, não constante.** Quando a proposta entra, a casa vai para
  a faixa do meio da coluna de texto: abaixo da nota, acima da legenda e à
  esquerda da proposta. `medeRecuo`, no diretor, mede esse vão no DOM e escreve
  `--recuo-x/--recuo-y/--recuo-escala`; o CSS aplica escala em torno do centro e
  depois o deslocamento, pesados por `--recuo`, e `deslocamentoDoChip` manda os
  chips pela MESMA conta. O valor antigo era fixo (-19cqw e escala 0,86) e
  acertava a tela em que foi calibrado; nas outras a casa recuava para baixo da
  nota, porque o texto não encolhe com a tela. O recuo é medido de novo quando
  o texto muda de altura sem o palco mudar (a fonte chega, a nota do nicho
  troca), e por isso o `ResizeObserver` observa o seletor e a legenda também.
- **O pan da câmera tira a casa da caixa mais que o zoom.** A visita a um
  cômodo puxa o quadro só parte do caminho (`PAN_DA_VISITA`: um terço no
  desktop, quase nada no retrato), e `--folga-da-camera` desconta o que sobra
  do tamanho da casa. Metade do caminho, o valor original, arrastava o desenho
  para cima das abas.

**No retrato** não há largura para separar, e a separação é pela ALTURA: as
faixas de texto são reservadas em cima e embaixo (`--faixa-topo` /
`--faixa-base`, medidas de 360 a 417px e escritas em rem, porque são texto).
Não há recuo: a proposta cobre o palco, a casa SOME (em vez de subir para trás
das abas a 30%, que era o fantasma visível), e os itens aparecem um por vez
(`--proximo`, o `surge` do item seguinte). O chip não reaparece em voo, porque
a casa já sumiu quando os itens voam e uma pílula atravessando o vazio não
aponta para nada; ele volta nos últimos 10% do voo, já como linha da proposta.
A atenuação vai no RÓTULO, nunca no `<li>`: pousado, o item é a linha, e a
linha não pode apagar.

**Para medir numa sessão local**, o que vale é o contorno das ARESTAS
(`.planta-aresta`) e não o grupo da câmera: o brilho do piso são elipses
translúcidas que passam do contorno de propósito, e o retângulo do grupo
acusaria corte onde não há nada visível.

## Armadilhas, todas silenciosas

- **`vector-effect: non-scaling-stroke` quebra o `pathLength`.** O tracejado
  passa a ser medido na tela, e o traço que se desenha vira pontilhado para
  sempre. As arestas da casa usam espessura em unidade do desenho.
- **Faces do SVG são opacas.** A ordem de desenho é o z-buffer; uma face
  translúcida mostra o que deveria esconder.
- **O canvas do 3D é opaco e soma por `screen`**, porque o bloom não preserva
  alfa. A mistura vai na CAIXA (`[data-casa]`), e não no canvas: o `translate`
  da caixa a isola, e o palco (`sticky`, outro grupo isolado) precisa de fundo
  sólido para ter com o que somar. Sem as duas coisas, retângulo preto. A borda
  do canvas ainda some numa máscara (`.cena-canvas`): o bloom espalha luz até a
  beirada, e um corte reto desenha a moldura do canvas por cima do palco.
- **Luz forte com queda lenta estoura a casa inteira.** A `PointLight` de cada
  cômodo é intensa (18) mas com `decay` alto (1,7) e alcance curto (7): o que se
  quer é uma poça de luz embaixo do pendente, não um cômodo uniformemente
  branco. Com queda quase linear a luz atravessava a planta toda, todas as
  faces passavam do limiar do bloom e o que sobrava na tela era uma nuvem branca
  sobre metade da casa. O bloom é o segundo botão do mesmo problema: limiar
  0,95, força 0,55.
- **Número de luzes fixo no three.** Uma `PointLight` por cômodo, sempre, com
  intensidade zero quando apagada; mudar a contagem recompila os programas e dá
  tranco no meio da rolagem.
- **Nenhum ancestral do palco pode ter `overflow`**: overflow desliga `sticky`
  nos descendentes, e a cena passa reto pela tela.
- **A coluna da proposta encosta no topo em tela baixa** (`max-height: 800px`),
  e encolhe o que dá: o nome do cômodo sai de cada linha e o respiro entre elas
  diminui. Ela tem ~590px de altura, que é o palco INTEIRO num notebook de
  614px, e centrada transbordava dos dois lados, enfiando o cabeçalho debaixo
  da barra fixa. **Escalar a coluna seria mais simples e está errado:** o
  diretor escreve o voo do chip em pixels medidos fora dela, e um `scale`
  encurtaria o voo na mesma proporção, deixando o item parado no meio do
  caminho.
- **O canvas é MAIOR que a caixa da casa** (`SOBRA_DO_QUADRO`, 25% por lado), e
  o frustum cresce na mesma fração. O SVG desenha com `overflow: visible` e pode
  passar da caixa; o canvas termina onde acaba, e com a câmera aproximando um
  cômodo a lateral da casa ficava decepada numa linha reta. Mexer num dos dois
  sem o outro muda a ESCALA do 3D, e aí a troca de renderizador no meio da cena
  dá um salto.
- **A aba em segundo plano não roda `requestAnimationFrame`**, e o `loopVisivel`
  pausa de propósito ali: numa automação de navegador com a aba escondida, o 3D
  nunca fica "pronto". Use o Playwright para conferir o 3D.

## Orçamento

O three.js entra por `next/dynamic` atrás de `DesktopOnlyWebGl`
(`(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion:
no-preference)`), então o celular e a corrida do Lighthouse (412px) nunca pedem
o chunk: eles veem o SVG, servido pronto e nunca hidratado (`SemHidratar`).
Guard: `tests/e2e/landing/cena-da-planta.spec.ts` confere `window.__THREE__`
indefinido a 412px.
