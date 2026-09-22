# CLAUDE.md — o site institucional da ProOps

## O que é

`proops.com.br`: a empresa, não o produto. São cinco páginas dentro do route
group `(empresa)`, servidas por **um layout só**:

| URL | Arquivo | O que é |
|---|---|---|
| `/` (via rewrite do apex) | `app/(empresa)/institucional/page.tsx` | a experiência longa, dez cenas |
| `/sobre` | `app/(empresa)/sobre/` | quem faz, a história, os números |
| `/manifesto` | `app/(empresa)/manifesto/` | um princípio por cena |
| `/produtos` | `app/(empresa)/produtos/` | ERP e aplicativo lado a lado |
| `/fale-conosco` | `app/(empresa)/fale-conosco/` | o assunto, e o formulário dele |

As quatro de baixo ficam **no nível do apex** e não debaixo de `/institucional`.
O porquê, e as três listas que uma página nova precisa atravessar, estão em
`app/CLAUDE.md`, seção "O site da empresa". Errar isso não quebra nada hoje: a
página some no dia da virada dos domínios.

**Uma casca só, e isso não é arrumação.** A raiz morava em `app/institucional/`
com layout próprio, ao lado do grupo. Dois layouts irmãos são duas subárvores do
React, então ir da raiz para uma sub-página desmontava o `EmpresaShell` inteiro:
a cortina sumia em vez de subir (o provider morria com o painel em pé), o Lenis
era recriado atrás de um `requestIdleCallback` e a rolagem inercial ficava fora
do ar por até dois segundos, e o campo de ponteiro recomeçava. Nada falhava, e
metade das navegações do site não tinha transição. Não dê `layout.tsx` a nenhuma
página daqui; guard em `src/__tests__/site-da-empresa-uma-casca.test.ts`.

## As quatro regras que não se negociam

Cada uma existe porque o projeto já pagou por ela.

### 1. Acima da dobra é CSS, nunca biblioteca de animação

`.hero-enter` e `.hero-rise-line` (globals.css) tocam sozinhas no primeiro
paint. Um `initial={{ opacity: 0 }}` do `motion` segura o texto do LCP invisível
até o bundle hidratar, que num celular estrangulado é vários segundos. Vale para
o herói da raiz e para o `HeroiPalco` das sub-páginas.

Tocar sozinha tem um preço, e ele é pago em dois lugares:

- **Numa navegação por cortina a página nova monta ATRÁS do painel preto**, e a
  entrada inteira tocava ali, escondida: quando o painel subia, o herói já
  estava parado no estado final. O `CurtainProvider` escreve
  `data-heroi="espera"` no `<html>` antes do `router.push` e apaga **quando a
  revelação termina**, não antes; a regra em globals.css pausa as duas classes
  enquanto o atributo existe. O atributo mora no `<html>` porque a página que vai
  animar ainda não existe quando a cortina fecha. Houve meio segundo de
  sobreposição ali, para a página parecer acordar enquanto era destapada, e na
  tela isso vira o herói se mexendo atrás da aresta do painel: parte da entrada
  perdida de novo, só que menos.

  **"Depois" só fica fluido com três coisas juntas**, e faltando qualquer uma
  volta a parecer travamento:

  1. A saída do painel ACELERA (`power2.in`). Com uma ease que desacelera, os
     últimos milímetros levavam mais de 100ms: para o olho o painel já tinha
     saído, e a entrada, que espera o fim da timeline, só vinha bem depois.
  2. `ScrollTrigger.refresh()` roda no INÍCIO de `abre()`, atrás do preto. Ele é
     medição de layout síncrona da página inteira; no `onComplete` caía no mesmo
     quadro em que a entrada era destravada, e a animação começava engasgando.
  3. O primeiro elemento da escada tem atraso ZERO. Qualquer atraso ali é página
     parada depois de o painel sair.
- **Os atrasos do herói da RAIZ são relativos à abertura**, via
  `esperaDaAbertura(useAberturaVaiTocar())`. Eles existem para deixar as seis
  lâminas saírem primeiro; escritos como `1,08s` fixos, viravam mais de um
  segundo de tela preta numa volta por dentro do site, onde a abertura não toca.
  Se acrescentar um elemento ao herói da raiz, some `espera` ao atraso dele.

### 2. A cena é escrita no estado FINAL e animada com `fromTo`

Sob `prefers-reduced-motion` nenhuma timeline é criada e nenhum `useTransform`
é aplicado: o que sobra é o markup do servidor. Se a cena for escrita no estado
inicial, quem pediu menos movimento vê a página pela metade, e nada falha.

`useScrollProgress` devolve `fallback` (padrão `1`, "já revelado") e
`animated: false` nesse caso. É o `animated` que decide se o `style` entra.

### 3. Todo loop novo entra no bloco de `prefers-reduced-motion`

E precisa ser pausável por `.anim-paused` (via `PauseOffscreen`). Atenção ao
caso da cortina de abertura: `animation: none` num keyframe com `both` deixaria
as lâminas em `scaleY(1)`, ou seja, a tela preta cobrindo a página para sempre.
O bloco reduzido tem que declarar o estado FINAL, não só desligar a animação.

### 4. Nada aqui pode ler sessão

As seis rotas estão em `SESSIONLESS_MARKETING_ROUTES` e renderizam fora do
`AuthProvider`. Um `useAuth`, `useTenant`, `usePlan` ou `usePagePermission`,
inclusive por componente compartilhado, é um contexto `undefined` em runtime que
nenhum type check pega.

## O kit de animação (`components/marketing/_shared/`)

| Peça | Para quê |
|---|---|
| `useScrollProgress` | progresso 0..1 de uma seção, como `MotionValue`. **É a base de quase toda cena.** |
| `useScrollScene` | cena GSAP com matchMedia e reduced-motion embutidos |
| `SplitReveal` | tipografia cinética com `SplitText` (reverte o split no cleanup, e escreve o estado inicial em TODAS as unidades) |
| `usePointerField` / `PointerFieldProvider` | escreve `--px`/`--py` no escopo |
| `Magnetic`, `Marquee`, `ScrubCounter` | primitivas de interação |
| `CurtainProvider` / `CurtainLink` | transição entre páginas |
| `webgl/` | `DesktopOnlyWebGl`, `loopVisivel` e `criaQuad`: WebGL só no desktop |
| `SemHidratar` | mantém o HTML do servidor sem hidratá-lo (o desenho da casa, hoje na landing do ERP) |

**Hoje o site da empresa não usa WebGL.** A casa em three.js foi embora com a
cena da planta, para a landing do ERP
(`components/marketing/cena-planta/`, que tem CLAUDE.md próprio). O que fica
aqui do kit é o `DesktopOnlyWebGl` e o `loopVisivel`, para a próxima cena que
precisar deles.

### `useScrollProgress`: por que ele existe

Duas decisões vieram de bugs reais, documentadas no arquivo:

- **O progresso vem do ScrollTrigger, nunca do `useScroll` do motion.** As
  páginas rodam Lenis, que está ligado ao `ScrollTrigger.update`. O `useScroll`
  lê o scroll por conta própria e adianta em relação ao que está pintado, então
  o reveal dispara antes do conteúdo chegar.
- **O ScrollTrigger é criado tarde, por IntersectionObserver** (`rootMargin:
  "150% 0px"`). `ScrollTrigger.create` faz medição de layout síncrona; criar um
  por seção no load custou ~1,7s de TBT na home do ERP, medido.

### Duas armadilhas do shader, ambas silenciosas

Nenhuma das duas dá erro em lugar nenhum: o shader compila, o programa linka, o
loop roda e a tela fica transparente.

1. **`smoothstep` com `edge0 > edge1` é indefinido em GLSL.** Aresta descendente
   se escreve `1.0 - smoothstep(a, b)` com `a < b`, nunca `smoothstep(b, a)`.
2. **`#extension` no fonte não basta em WebGL 1.** A extensão precisa ter sido
   pedida no contexto antes de compilar, senão a diretiva não faz nada e o
   builtin que ela libera fica indefinido. É por isso que `criaQuad` recebe a
   lista de extensões e devolve `null` se alguma faltar.

E uma armadilha da largura de linha: `fract(campo * n)` comparado com constante
dá linha cuja espessura é inversamente proporcional ao gradiente local, ou seja,
manchas onde o campo é liso. Dividir a distância até a dobra por `fwidth`
converte para espaço de tela e todas as linhas saem com o mesmo peso.

### O que sobrou de WebGL por aqui

Nada, hoje. Se voltar a entrar, vale a regra que a cena da planta pagou: o
módulo entra por `next/dynamic` atrás de `DesktopOnlyWebGl`
(`(min-width: 1024px) and (pointer: fine)`), e a versão SEM WebGL é renderizada
sempre, por baixo. Não é estética, é orçamento: o Lighthouse mede num viewport
de 412px, e ali o chunk não pode nem ser pedido.

`.campo-reativo` e `.grade-pontos` continuam no globals.css: outras seções do
site ainda os usam.

## Orçamento

`/institucional` tem teto próprio de TBT no `lighthouserc.json` (1200ms contra
os 800 genéricos) e **CLS ≤ 0,1 é `error`**. Daí duas escolhas estruturais:

- **Palco `sticky` não pode ter ancestral com `overflow`.** Overflow em qualquer
  ancestral desliga `position: sticky` nos descendentes, e o sintoma é a cena
  passando reto, sem erro e com o layout ainda parecendo quase certo. É por isso
  que `Secao` (que traz `overflow-hidden`) está proibido para cena pinada, e a
  cena monta a própria `<section>`. Já custou uma vez, em `/produtos`.
- **Nunca combine uma classe `scale-*` do Tailwind com transform de JS no mesmo
  elemento.** No v4 o `scale-y-0` compila para a propriedade CSS `scale`, que
  COMPÕE com `transform` em vez de ser sobrescrita por ele: o elemento fica
  achatado por mais que o GSAP anime, sem erro nenhum. Foi assim que a cortina de
  transição rodou sem cobrir um pixel. Ou o transform é do CSS, ou é do JS.
- **Transform num ancestral cria bloco de contenção para `fixed`.** Vale para a
  propriedade `translate` que as classes `translate-*` do v4 geram e vale para o
  transform inline que o `motion` escreve, inclusive quando o valor é zero. Um
  painel `fixed inset-0` dentro de um cabeçalho que recua não cobre a tela,
  cobre a CAIXA DO CABEÇALHO. O sintoma é
  um menu de tela cheia recortado numa faixa de uns cento e cinquenta pixels, com
  a página aparecendo por baixo, sem erro nenhum. Painel de tela cheia é IRMÃO do
  cabeçalho, nunca filho. Guard: `tests/e2e/mobile/indice-empresa.spec.ts`.
- **Cena longa é `sticky`, não `pin` do ScrollTrigger.** Um pin insere um
  espaçador e reescreve a altura do documento; com várias cenas isso vira
  medição a cada refresh, e um ScrollTrigger aninhado passa a medir contra o
  espaçador em vez do viewport.
- **Cena horizontal precisa de cartão largo.** O trilho só rola se for mais largo
  que o viewport: encurtar o texto dos cartões da linha do tempo fez os quatro
  caberem na tela, `distance()` foi a zero, e o pin ficou lá sem nada para fazer.
  Mudou o texto de uma cena horizontal? Confira a largura.
- **Deslocamento de cena é `vw`/`vh`, não `%`.** Porcentagem em `translate` é
  relativa à caixa do PRÓPRIO elemento: foi assim que as seis planilhas da cena
  do problema nasceram amontoadas no meio do palco. O palco é `overflow-hidden`,
  então o que começa fora da borda é cortado e não alarga o documento, que é
  exatamente o que o guard de overflow a 393px vigia.

## A barra é uma cápsula que reage ao scroll

`components/institucional/empresa-navbar.tsx`. Quatro comportamentos, e cada um
existe por um motivo desta superfície:

| O quê | Por quê |
|---|---|
| Vira **cápsula** passados 24px | o resto do site é editorial; uma barra chapada de ponta a ponta é a única peça que ninguém desenhou |
| **Pílula** com `layoutId` segue o ponteiro e volta para a página atual | um elemento só DESLIZA entre destinos; sublinhado por link seriam quatro animações independentes |
| **Recua 8px** ao descer, volta ao subir | as páginas são cenas de tela cheia presas ao scroll, e a barra parada por cima é ruído. Duas versões erraram a dose antes: sair inteira da tela tirava o menu de onde a pessoa o procura, e esmaecer custava a legibilidade do único elemento sempre presente. Sobrou o deslocamento, numa mola do `motion`, porque uma transição CSS de 8px é curta demais para ter curva e sai seca. Perto do topo (abaixo de 1,2 tela) ela nunca recua |
| **Filete de progresso** rente à borda de baixo | páginas longas, e a cápsula tem espaço para dar essa informação de graça |

Três regras ao mexer nela:

- **Um `<nav aria-label="Principal">` só, que muda de forma.** Duas barras que se
  revezassem seriam dois conjuntos do mesmo menu no DOM: "Manifesto" existindo em
  dois lugares para um leitor de tela e para qualquer seletor por papel.
- **O índice do celular é irmão do `<header>`.** Ver a armadilha do `translate`
  na seção de orçamento; dentro dele o painel não cobre a tela.
- **O progresso é `MotionValue`, não estado.** Escrever progresso de scroll em
  `useState` é um render por quadro. Um listener passivo só, com o trabalho
  coalescido em `requestAnimationFrame`, resolve as três reações ao scroll.

## O herói da raiz fala da EMPRESA

"Software de gestão para quem vende projeto": o título responde PARA QUEM a
ProOps faz software, e o lead conta a origem (novembro de 2025, dentro de uma
operação que vende projeto). Ao lado, o mural
(`_components/heroi/mural-de-segmentos.tsx`, servidor, sem JavaScript): uma
grade com os negócios que vendem projeto, uma luz percorrendo célula a célula,
e a última, pontilhada, sendo "o seu".

O mural é tipografia fazendo trabalho de ilustração, e é de propósito: é a
resposta mais direta à pergunta que faz alguém fechar a aba na primeira tela,
"isto serve para o meu negócio?". Quem já vem pronto está marcado como tal, e o
resto é "configurado", a mesma distinção da seção "O seu segmento", pelo mesmo
motivo (ver "Texto", no fim).

A luz é UM keyframe (`.mural-acende`) com atraso proporcional por célula, então
acrescentar um segmento em `SEGMENTOS` não pede nada no CSS. Duas coisas que
parecem detalhe e não são: a volta ao apagado tem parada própria em 13% (sem
ela a interpolação desfaz o acendimento ao longo do ciclo inteiro, e metade do
mural fica meio acesa o tempo todo, o que se lê como células de brilho
diferente, não como luz passando); e ela acende com `box-shadow: inset`, não
com `background`, porque o fundo da célula é o da seção.

**As heros são PRETO E BRANCO.** `.superficie-noite` é monocromática: `--noite`,
`--noite-alta`, `--papel` e `--luz` (branco), que é o token que qualquer realce
usa. Uma versão anterior tinha luz de tungstênio e ardósia azulada; ficava bom
isolado e não era a marca. Cor entra só onde é conteúdo, não decoração.

**A raiz já abriu com a cena da planta, do ambiente ao dinheiro no financeiro, e
isso foi um erro de superfície.** A cena ficou boa e continua viva, na landing
do ERP (`components/marketing/cena-planta/`). Aqui ela custava duas coisas:

1. respondia "como o sistema funciona", que é a pergunta de quem já está
   avaliando o produto, e não de quem abriu o site da empresa;
2. mostrava a ProOps pelo exemplo de UM nicho. Quem vende outro tipo de projeto
   batia o olho e se excluía sozinho, que é a pior perda possível: não é
   objeção, é mal-entendido.

Daí também a seção "O seu segmento" (`institucional-segmento.tsx`), que separa
o que já vem pronto do que é configurado. Ver "Cada assunto tem UM dono".

Duas regras de quem mexer no herói da raiz:

- **Todo atraso soma `--espera`**, que a `EsperaDaAbertura` escreve: a escada só
  começa depois de as lâminas da abertura saírem, e numa volta por dentro do
  site, onde a abertura não toca, ela começa na hora.
- **O `<h1>` começa por "ProOps"** (num `sr-only`), e o E2E confere: é o que o
  título da página diz primeiro para quem não vê a cena.

## O herói das sub-páginas: `HeroiPalco` e uma cena por página

`components/institucional/herois/`: `HeroiPalco` (a seção), `HeroiTitulo` e
`LinhaHero` (o `<h1>` em linhas explícitas), `HeroiFicha` (a linha de créditos)
e `SaidaDoHeroi` (o parallax de saída, a única parte com JavaScript). Os quatro
heróis nasceram iguais, com uma "assinatura" trocada, e quem navegava as quatro
em sequência via o mesmo cartão quatro vezes. Agora cada página passa uma CENA
do próprio assunto, que ocupa espaço de verdade na composição, no celular
inclusive:

| Página | Cena | Onde |
|---|---|---|
| `/produtos` | uma placa que se divide na janela do ERP e no telefone do aplicativo, ligados por um fio | `produtos/_components/heroi-aparelhos.tsx`, CSS puro |
| `/manifesto` | uma balança: os princípios num prato, as contrapartidas no outro, pendendo numa mola | `manifesto/_components/heroi-balanca.tsx` (`composicao="centro"`) |
| `/sobre` | os quatro marcos numa linha que, no último, se divide nas duas pontas: o ERP e o aplicativo | `sobre/_components/heroi-bifurcacao.tsx`, zero JS |
| `/fale-conosco` | as três conversas já começadas; clicar numa escolhe o assunto do formulário | `fale-conosco/_components/heroi-conversas.tsx` + `canal-escolhido.ts` |

Regras ao mexer:

- **Tela cheia, sempre** (`min-h-[100svh]`). Um herói de 82svh deixa uma faixa
  da seção seguinte no rodapé, e a abertura passa a parecer um cabeçalho alto.
- **A ficha fica NO FLUXO**, empurrada para o rodapé por `mt-auto`. Ela já foi
  posicionada por baixo com um `pb` grande reservando o espaço, e isso só
  funcionava enquanto a altura do conteúdo era previsível; com uma cena de
  verdade no herói, ela encostava na cena no celular. **Rótulo curto**: fica ao
  lado do número, não embaixo.
- **A entrada da cena é CSS**, com o estado final declarado no bloco de
  movimento reduzido, e toda classe de entrada nova entra na regra de pausa
  `html[data-heroi="espera"]` (guard: `site-da-empresa-uma-casca.test.ts`).
  Keyframe que move um elemento que também inclina por ponteiro anima as
  propriedades INDIVIDUAIS (`translate`, `rotate`, `scale`), e a inclinação
  fica num filho, em `transform`: as duas compõem em vez de uma apagar a outra.
- **Todo traço animado declara `pathLength={1}`.**
- **A mola do JavaScript nunca vai no elemento da entrada CSS.** Uma animação
  CSS vence o transform inline; a balança tem a entrada no wrapper e a mola na
  viga, de dentro.
- **`/sobre` não atribui marco a sócio.** Autoria de marco é fato que a página
  não tem, e por isso a linha do tempo mostra data e título, e mais nada. Se um
  dia houver atribuição confirmada, ela entra em `Marco`. A cena já foi um
  `git log`, com hash, prompt e janela de terminal: a geometria estava certa e
  o vocabulário não, porque quem abre esta página compra software, não escreve.
- **`.hero-enter` escreve `filter` no elemento** (`fill-mode: both`) e apaga
  qualquer `filter` do Tailwind ali. Filtro vai num FILHO do que entra.

## Cada assunto tem UM dono

A primeira versão repetia: os três princípios apareciam na raiz, em `/sobre` e em
`/manifesto`; marcos, pessoas e números apareciam em dois lugares cada. Quem leu a
raiz não tinha motivo para abrir uma sub-página, e quem abria encontrava o que já
tinha lido.

| Assunto | Raiz mostra | Dono |
|---|---|---|
| Princípios | `resumo`, uma linha por carta | `/manifesto` (`texto` + `detalhe`) |
| Marcos | `resumo`, uma linha por marco | `/sobre` (`texto`) |
| Pessoas | nomes, papéis e formação | `/sobre` (retratos e falas) |
| Números | a cena inteira | a raiz; `/sobre` não os repete |
| Telas dos produtos | os dois painéis | `/produtos` (as capturas) |
| Contrapartidas | nada | `/manifesto` (`CONTRAPARTIDAS`: `curto` na balança, `falta` e `porque` na seção) |
| Segmento e nicho | a seção "O seu segmento" | a raiz; `/produtos` conta a origem e o que não está preso a ela |

O modelo de conteúdo é que sustenta isso: `Principio` e `Marco` têm um campo
`resumo` **separado** do `texto`, e cada campo tem uma superfície só. Ao
acrescentar assunto novo, decida o dono antes de escrever o componente, senão a
duplicação volta pela porta dos fundos.

## Toda revelação toca DE NOVO quando o leitor volta

`SplitReveal` (modo `rise`), `BlocosRevelados` e a chegada das cópias de
`/produtos` no celular usam `toggleActions: CENA_REPETE`
(`"restart none none reset"`), e não `once: true`. Descer revela, subir de volta
devolve a cena ao estado inicial, descer de novo revela de novo.

O argumento a favor do `once` está escrito no histórico e era razoável: texto
que volta a apagar enquanto alguém sobe para reler é hostil. O que o derrubou é
que numa página inteira construída sobre movimento uma seção que não responde
mais na segunda passada parece quebrada, e o leitor não tem como saber que ela
"já tocou". Como o `reset` acontece ao sair pelo topo, a cena está fora de vista
quando volta ao estado inicial: ninguém vê texto apagar debaixo do olho.

Cena com `scrub` (tudo que usa `useScrollProgress`) já era reversível por
construção e não precisa disto.

## O fecho de cada página revela linha a linha

`/sobre` ("Uma nota"), `/manifesto` ("A contrapartida"), `/produtos` ("Por que
os dois") e `/fale-conosco` ("Quem responde") terminam com `SplitReveal` em
`unit="lines"`. Uma página que passou por quatro cenas com movimento não pode
terminar num bloco de `<p>` inerte, que foi como `/produtos` ficou por um tempo.

**`SplitReveal` escreve o estado inicial com um `gsap.set` em todas as unidades,
antes do `fromTo`, e isso não é redundância.** Com `stagger`, o render imediato
do `fromTo` alcança só a PRIMEIRA unidade: as outras ficam visíveis e no lugar
até a sub-tween delas começar, e nesse instante saltam para invisível antes de
subir. O que se vê é um pisca, e como esses parágrafos têm duas linhas cada,
metade delas piscava. Nada falha: o texto está lá, legível, e a animação
acontece. O guard é o E2E `institucional/site-da-empresa.spec.ts`, que afirma
que com a página no topo toda `.split-line` do fecho está em `opacity: 0`.

## Texto

Tudo vem de `_content/institucional-copy.ts`. `PLACEHOLDER = true` liga os selos
âmbar; virar para `false` some com todos de uma vez.

O briefing de setembro de 2026 fechou o texto: a origem (a ProOps nasceu em
novembro de 2025 dentro da empresa de automação residencial de um dos sócios,
porque montar uma proposta levava horas), as quatro datas, o exemplo concreto de
cada princípio e os três números. **`PLACEHOLDER` está em `false`** e não há
selo âmbar em nenhuma seção.

Ao acrescentar texto que seja chute, ligue `PLACEHOLDER` de volta e ponha um
`<PlaceholderBadge>` na seção. O selo não é decoração de rascunho: uma empresa
nova é conferida justamente pelos números, e número inventado numa página
institucional para de ser rascunho e vira afirmação.

Sobre número, duas regras que valem para sempre. Só entra o que dá para
conferir. E a grade da cena de números segue o tamanho de `NUMEROS` em vez de
fixar três, porque uma célula vazia com borda parece dado que não carregou:
publicar dois números certos é melhor do que três com um enfeitado.

Valem os dois guards de copy do projeto: nada de travessão como pontuação, e
"a ProOps", sempre feminino.

**A promessa de nicho aparece em quatro superfícies, e as quatro precisam
concordar**: a seção "O seu segmento" aqui, a galeria de nichos da landing do
ERP (`landing-niches.tsx`, com o terceiro cartão "O seu segmento"), a FAQ da
landing (`_shared/faq-data.ts`) e a seção "De onde vem o ERP" de `/produtos`. O
que pode ser dito como PRONTO é o que existe em `lib/niches/config.ts`, que hoje
são dois; o resto é "configurado", e a diferença entre as duas palavras é o que
separa promessa de mentira.

## Ao rodar localmente

O dev server deste projeto tem histórico de servir CSS defasado: uma classe nova
no `globals.css` ou um utilitário novo do Tailwind num arquivo recém-criado pode
simplesmente não aparecer, sem erro nenhum. O sintoma é um layout que ignora a
classe que está claramente no arquivo. Confirme buscando a regra no CSS servido
antes de "consertar" o componente; a cura é `rm -rf apps/web/.next` e reiniciar.

**Ao inspecionar por automação de navegador**, lembre de duas coisas:

- `window.scrollTo` **não** aciona o Lenis, e o Lenis é quem chama
  `ScrollTrigger.update`. A página se move e as cenas congelam no progresso
  anterior, o que parece cena quebrada e é ferramenta errada. Só evento de roda
  de verdade serve.
- Uma aba em segundo plano tem `document.visibilityState === "hidden"`, e ali
  **o `requestAnimationFrame` simplesmente não roda**. Isso derruba as duas
  coisas que dependem de quadro: o `loopVisivel` do WebGL (que além disso pausa
  de propósito nesse estado) e a escrita coalescida de `--px`/`--py` do
  `usePointerField`. Canvas transparente e `--px` ausente numa captura de
  automação não são prova de nada; o listener anexa, e dá para confirmar isso
  com um `console.log` temporário no efeito.
