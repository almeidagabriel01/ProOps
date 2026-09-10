# CLAUDE.md — o site institucional da ProOps

## O que é

`proops.com.br`: a empresa, não o produto. São seis páginas, servidas por dois
layouts que montam a mesma casca:

| URL | Arquivo | O que é |
|---|---|---|
| `/` (via rewrite do apex) | `app/institucional/page.tsx` | a experiência longa, dez cenas |
| `/sobre` | `app/(empresa)/sobre/` | quem faz, a história, os números |
| `/manifesto` | `app/(empresa)/manifesto/` | um princípio por cena |
| `/produtos` | `app/(empresa)/produtos/` | ERP e aplicativo lado a lado |
| `/carreiras` | `app/(empresa)/carreiras/` | como se trabalha aqui, e as vagas |
| `/fale-conosco` | `app/(empresa)/fale-conosco/` | o canal certo por assunto |

As cinco de baixo ficam **no nível do apex** e não debaixo de `/institucional`.
O porquê, e as três listas que uma página nova precisa atravessar, estão em
`app/CLAUDE.md`, seção "O site da empresa". Errar isso não quebra nada hoje: a
página some no dia da virada dos domínios.

## As quatro regras que não se negociam

Cada uma existe porque o projeto já pagou por ela.

### 1. Acima da dobra é CSS, nunca biblioteca de animação

`.hero-enter` e `.hero-rise-line` (globals.css) tocam sozinhas no primeiro
paint. Um `initial={{ opacity: 0 }}` do `motion` segura o texto do LCP invisível
até o bundle hidratar, que num celular estrangulado é vários segundos. Vale para
o herói da raiz e para o `PaginaHero` das sub-páginas.

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
| `SplitReveal` | tipografia cinética com `SplitText` (reverte o split no cleanup) |
| `usePointerField` / `PointerFieldProvider` | escreve `--px`/`--py` no escopo |
| `Magnetic`, `Marquee`, `ScrubCounter` | primitivas de interação |
| `CurtainProvider` / `CurtainLink` | transição entre páginas |
| `webgl/` | WebGL cru, sem dependência, só desktop |

**Hoje o WebGL tem um consumidor só**: o campo de contorno atrás do herói da
raiz. A distorção de imagem por velocidade de scroll, prevista para a faixa de
pessoas, está de fora de propósito: ainda não há fotografia, e um shader de
distorção sobre um monograma placeholder é construir a coisa errada. O ponto de
extensão está pronto (`criaQuad` aceita a lista de extensões, `loopVisivel`
pausa sozinho), e a hora é quando as fotos chegarem.

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

### O campo reativo, em três camadas

1. `webgl/flow-field` — desktop com ponteiro fino, via `DesktopOnlyWebGl`
2. `.campo-reativo` — dois glows em CSS lendo os mesmos `--px`/`--py`
3. o estado parado, quando as variáveis ficam em 0 (reduced motion)

A camada 2 é renderizada SEMPRE e a 1 vem por cima. Isso é o que faz um
navegador sem WebGL, um celular e a corrida do Lighthouse degradarem sem flash.

**O gate `(min-width: 1024px) and (pointer: fine)` não é estética, é orçamento:**
o Lighthouse mede num viewport de 412px, então o módulo nunca é importado ali e
custa exatamente zero TBT na métrica que reprova o build.

## Orçamento

`/institucional` tem teto próprio de TBT no `lighthouserc.json` (1200ms contra
os 800 genéricos) e **CLS ≤ 0,1 é `error`**. Daí duas escolhas estruturais:

- **Cena longa é `sticky`, não `pin` do ScrollTrigger.** Um pin insere um
  espaçador e reescreve a altura do documento; com várias cenas isso vira
  medição a cada refresh, e um ScrollTrigger aninhado passa a medir contra o
  espaçador em vez do viewport.
- **Deslocamento de cena é `vw`/`vh`, não `%`.** Porcentagem em `translate` é
  relativa à caixa do PRÓPRIO elemento: foi assim que as seis planilhas da cena
  do problema nasceram amontoadas no meio do palco. O palco é `overflow-hidden`,
  então o que começa fora da borda é cortado e não alarga o documento, que é
  exatamente o que o guard de overflow a 393px vigia.

## Texto

Tudo vem de `_content/institucional-copy.ts`. `PLACEHOLDER = true` liga os selos
âmbar; virar para `false` some com todos de uma vez. Os números são **zero** de
propósito: número inventado numa página institucional para de ser rascunho e
vira afirmação.

Valem os dois guards de copy do projeto: nada de travessão como pontuação, e
"a ProOps", sempre feminino.

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
